import {Locator} from '@playwright/test';
import {expect, test} from './support/mock-backend';
import {AdminPage} from './support/admin-page';
import {aUser} from '../src/testing/fixtures';
import {Role} from '../src/app/shared/model/user';
import type {SourceDto} from '../src/app/shared/model/source';
import type {WorkspaceDto} from '../src/app/shared/model/workspace';
import {MockCollection} from './support/mock-rest';

const now = '2026-03-02T09:30:00Z';
const aWorkspace = (workspace: Partial<WorkspaceDto>): WorkspaceDto => ({
	id: 1,
	name: 'GENERAL',
	hypotheticalQuestions: [],
	sources: [],
	createdAt: now,
	updatedAt: now,
	...workspace
});
const aSource = (name: string, id: number): SourceDto => ({id, name, hypotheticalQuestions: [], contents: [], createdAt: now, updatedAt: now});

test.describe('Administration des workspaces', () => {
	let workspaces: MockCollection<WorkspaceDto>;
	let admin: AdminPage;
	let table: Locator;

	test.beforeEach(async ({page, backend}) => {
		backend.user = aUser({roles: [Role.USER, Role.ADMIN]});
		let nextId = 10;
		workspaces = await backend.collection(
			'/workspaces',
			'name',
			[
				aWorkspace({id: 1, name: 'GENERAL', description: 'Toutes les sources'}),
				aWorkspace({id: 2, name: 'Cotisations', description: 'Cotisations AVS/AI', sources: ['zas_website'], hypotheticalQuestions: ['Quel taux ?']})
			],
			body => aWorkspace({...body, id: nextId++})
		);
		await backend.collection('/sources', 'name', [aSource('zas_website', 1), aSource('ahv_iv_mementos', 2)]);
		admin = new AdminPage(page);
		await admin.open();
		const panel = await admin.openPanel('Workspaces');
		table = panel.getByRole('table', {name: 'Liste des workspaces'});
	});

	test('liste les workspaces et déplie le détail d’un workspace', async ({backend}) => {
		await expect(table.getByRole('columnheader')).toHaveText(['Nom', 'Description', 'Sources', 'Mis à jour le', 'Actions']);
		const row = admin.row(table, 'Cotisations');
		await expect(row).toContainText('Cotisations AVS/AI');
		await expect(row.getByRole('button', {name: '1 source(s)'})).toBeVisible();

		await row.getByRole('button', {name: '1 source(s)'}).click();

		await expect(table.getByText('Quel taux ?')).toBeVisible();
		await expect(table.getByText('Site Web CdC')).toBeVisible();
		expect(backend.requestsTo('GET', '/workspaces')).toHaveLength(1);
	});

	test('crée un workspace avec des sources et des questions hypothétiques', async ({page, backend}) => {
		await page.getByRole('button', {name: 'Nouveau workspace'}).click();
		const dialog = admin.dialog('Créer un workspace');
		const create = dialog.getByRole('button', {name: 'Créer'});
		await expect(create).toBeDisabled();

		// Attendre le focus initial de la boîte de dialogue : posé après coup, il détournerait la saisie suivante.
		await expect(dialog.getByRole('textbox', {name: 'Nom'})).toBeFocused();
		await dialog.getByRole('textbox', {name: 'Nom'}).fill('Prestations');
		await dialog.getByRole('textbox', {name: 'Description'}).fill('Rentes et allocations');
		await dialog.getByRole('combobox', {name: 'Sources'}).click();
		await page.getByRole('option', {name: 'Mémentos AVS/AI'}).click();
		await page.getByRole('option', {name: 'Site Web CdC'}).click();
		await page.keyboard.press('Escape');
		const question = dialog.getByPlaceholder('Ajouter une question puis Entrée');
		await question.fill('Quand toucher ma rente ?');
		await question.press('Enter');
		await expect(dialog.getByRole('row', {name: /Quand toucher ma rente \?/})).toBeVisible();
		await create.click();

		await expect(page.getByText('Workspace créé avec succès')).toBeVisible();
		await expect(dialog).toBeHidden();
		await expect(admin.row(table, 'Prestations').getByRole('button', {name: '2 source(s)'})).toBeVisible();
		expect(backend.requestsTo('POST', '/workspaces')).toEqual([
			expect.objectContaining({
				body: {
					name: 'Prestations',
					description: 'Rentes et allocations',
					hypotheticalQuestions: ['Quand toucher ma rente ?'],
					sources: ['zas_website', 'ahv_iv_mementos']
				}
			})
		]);
		expect(backend.requestsTo('GET', '/workspaces')).toHaveLength(2);
	});

	test('modifie un workspace existant (le nom n’est pas modifiable)', async ({page, backend}) => {
		await admin.rowAction(admin.row(table, 'Cotisations'), 'pencil').click();
		const dialog = admin.dialog('Modifier le workspace');
		await expect(dialog.getByRole('textbox', {name: 'Nom'})).toHaveValue('Cotisations');
		await expect(dialog.getByRole('textbox', {name: 'Nom'})).toBeDisabled();
		await expect(dialog.getByRole('textbox', {name: 'Description'})).toBeFocused();
		await expect(dialog.getByRole('combobox', {name: 'Sources'})).toContainText('Site Web CdC');

		await dialog.getByRole('textbox', {name: 'Description'}).fill('Cotisations des indépendants');
		await dialog.getByRole('button', {name: 'Retirer'}).click();
		await dialog.getByRole('button', {name: 'Enregistrer'}).click();

		await expect(page.getByText('Workspace mis à jour avec succès')).toBeVisible();
		await expect(admin.row(table, 'Cotisations')).toContainText('Cotisations des indépendants');
		expect(backend.requestsTo('PUT', '/workspaces/Cotisations')).toEqual([
			expect.objectContaining({body: {description: 'Cotisations des indépendants', hypotheticalQuestions: [], sources: ['zas_website']}})
		]);
		expect(workspaces.find('Cotisations')?.hypotheticalQuestions).toEqual([]);
	});

	test('supprime un workspace après confirmation ; « Retour » annule', async ({page, backend}) => {
		const row = admin.row(table, 'Cotisations');
		const confirmation = admin.dialog('Supprimer le workspace');

		await admin.rowAction(row, 'delete').click();
		await expect(confirmation).toContainText('Voulez-vous vraiment supprimer ce workspace ? Cette action est irréversible.');
		await confirmation.getByRole('button', {name: 'Retour'}).click();
		await expect(confirmation).toBeHidden();
		await expect(row).toBeVisible();
		expect(backend.requestsTo('DELETE', /^\/workspaces\//)).toEqual([]);

		await admin.rowAction(row, 'delete').click();
		await confirmation.getByRole('button', {name: 'Confirmer'}).click();

		await expect(page.getByText('Workspace supprimé avec succès')).toBeVisible();
		await expect(row).toHaveCount(0);
		await expect(admin.row(table, 'GENERAL')).toBeVisible();
		expect(backend.requestsTo('DELETE', /^\/workspaces\//).map(request => request.path)).toEqual(['/workspaces/Cotisations']);
	});

	// Bug : les boutons « Modifier » et « Supprimer » de chaque ligne n'ont qu'une infobulle (`matTooltip`, exposée comme
	// description), sans `aria-label` : aucun nom accessible (src/app/admin/workspaces/workspaces.component.html, l. 48 et 51).
	test.fixme('les actions d’une ligne ont un nom accessible', async () => {
		const row = admin.row(table, 'Cotisations');
		await expect(admin.rowAction(row, 'pencil')).toHaveAccessibleName(/Modifier/);
		await expect(admin.rowAction(row, 'delete')).toHaveAccessibleName(/Supprimer/);
	});
});

// Les routes des workspaces et sources sont simulées : aucune de ces requêtes ne doit tomber dans le filet générique
// (les autres panneaux de l'administration chargent leurs propres données, hors du périmètre de ces parcours).
test.afterEach(({backend}) => expect(backend.unexpected.filter(request => /\/zia\/api\/(workspaces|sources)\b/.test(request))).toEqual([]));
