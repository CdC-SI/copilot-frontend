import {Locator, Page} from '@playwright/test';
import {expect, test} from './support/mock-backend';
import {CorpusPage, PersonalDocuments, aPersonalDocument} from './support/corpus-page';
import {textPdf} from './support/pdf';
import type {SourceDto} from '../src/app/shared/model/source';
import type {WorkspaceDto} from '../src/app/shared/model/workspace';
import type {ISourceRequest} from '../src/app/shared/model/source-request';

const pdf = textPdf(['Directive interne sur les cotisations.']);
const aPdf = (name: string) => ({name, mimeType: 'application/pdf', buffer: pdf});
const panel = (page: Page): Locator => page.locator('zco-source-viewer-panel');

// La page charge tous ses onglets dès l'ouverture : listes vides par défaut, remplacées au besoin par chaque test
// (une route déclarée plus tard est prioritaire).
test.beforeEach(async ({backend}) => {
	for (const path of ['/documents/user-docs', '/source-requests/my', '/workspaces', '/sources']) {
		await backend.on('GET', path, () => ({json: []}));
	}
});

test.describe('Corpus : documents personnels', () => {
	test('un document envoyé apparaît en traitement, puis traité au rafraîchissement automatique', async ({page, backend}) => {
		const documents = await PersonalDocuments.install(backend);
		await page.clock.install();
		const corpus = new CorpusPage(page);
		await corpus.open();
		await expect(corpus.tabPanel('Mes documents').getByText('Aucun document téléchargé')).toBeVisible();

		await corpus.chooseFiles(aPdf('directive-révisée.pdf'));
		await expect(corpus.queuedFile('directive-révisée.pdf')).toContainText(`directive-révisée.pdf (${Math.round(pdf.length / 1024)} KB)`);
		await corpus.uploadButton.click();

		await expect(page.getByText('Document(s) téléchargé(s) avec succès')).toBeVisible();
		await expect(page.getByText('Le document est en cours de traitement.', {exact: false})).toBeVisible();
		await expect(corpus.queuedFile('directive-révisée.pdf')).toHaveCount(0);
		const card = corpus.document('directive-révisée.pdf');
		await expect(card).toContainText('En cours de traitement');
		await expect(corpus.action(card, 'Ouvrir')).toBeDisabled();
		const [upload] = backend.requestsTo('POST', '/documents/upload');
		expect(upload.body).toEqual(expect.stringContaining('filename="directive-révisée.pdf"'));

		// Le traitement se termine côté serveur : le rafraîchissement automatique (toutes les 30 s) le reflète.
		documents.find('directive-révisée.pdf').status = 'PROCESSED';
		await page.clock.fastForward(30_000);

		await expect(card).toContainText('Traité');
		await expect(corpus.action(card, 'Ouvrir')).toBeEnabled();
		await expect(page.getByText('Le document est en cours de traitement.', {exact: false})).toBeHidden();
	});

	test('un envoi refusé affiche la raison et garde le fichier en attente', async ({page, backend}) => {
		const documents = await PersonalDocuments.install(backend);
		documents.uploadReplies.push({status: 400, json: {MESSAGE: 'FILE_TOO_LARGE', FILENAME: 'rapport-annuel.pdf'}});
		const corpus = new CorpusPage(page);
		await corpus.open();

		await corpus.chooseFiles(aPdf('rapport-annuel.pdf'));
		await corpus.uploadButton.click();

		await expect(page.getByText('Le fichier est trop volumineux')).toBeVisible();
		await expect(corpus.queuedFile('rapport-annuel.pdf')).toBeVisible();
		await expect(corpus.uploadButton).toBeEnabled();
		expect(documents.items).toEqual([]);
	});

	test('affiche la cause d’un échec de traitement et réactive un document archivé', async ({page, backend}) => {
		await PersonalDocuments.install(backend, [
			aPersonalDocument({title: 'scan.pdf', status: 'FAILED', errorCode: 'EMBEDDING_NO_CONTENT'}),
			aPersonalDocument({title: 'ancien-guide.pdf', availabilityStatus: 'ARCHIVED', timeToLiveInDays: 3})
		]);
		const corpus = new CorpusPage(page);
		await corpus.open();

		const failed = corpus.document('scan.pdf');
		await expect(failed).toContainText('Échoué');
		await expect(failed.getByRole('alert')).toHaveText("Aucun texte exploitable n'a pu être extrait du document");
		await expect(corpus.action(failed, 'Ouvrir')).toBeDisabled();

		const archived = corpus.document('ancien-guide.pdf');
		await expect(archived).toContainText('Archivé');
		await expect(archived).toContainText('Suppression dans 3 jour(s)');
		await corpus.action(archived, 'Réactiver').click();

		await expect(page.getByText('Document réactivé avec succès')).toBeVisible();
		await expect(archived).toContainText('Actif');
		await expect(archived).toContainText('Archivage dans 30 jour(s)');
		expect(backend.requestsTo('PUT', '/documents/user-docs/reactivate')).toEqual([expect.objectContaining({query: {filename: 'ancien-guide.pdf'}})]);
	});

	test('ouvre un PDF personnel dans le panneau, le télécharge puis le supprime', async ({page, backend}) => {
		await PersonalDocuments.install(backend, [aPersonalDocument({title: 'guide-avs.pdf'}), aPersonalDocument({title: 'memo.pdf'})]);
		backend.documents.set('guide-avs.pdf', {body: pdf, contentType: 'application/pdf'});
		const corpus = new CorpusPage(page);
		await corpus.open();
		const card = corpus.document('guide-avs.pdf');

		await corpus.action(card, 'Ouvrir').click();
		const viewer = panel(page);
		await expect(viewer.getByRole('heading', {level: 2})).toContainText('guide-avs.pdf');
		await expect(viewer.getByRole('toolbar')).toContainText('Page 1 sur 1', {timeout: 30_000});
		await expect(viewer.locator('.textLayer')).toContainText('Directive interne');
		await viewer.getByRole('button', {name: 'Fermer le panneau des sources'}).click();
		await expect(viewer).toBeHidden();

		const downloading = page.waitForEvent('download');
		await corpus.action(card, 'Télécharger').click();
		expect((await downloading).suggestedFilename()).toBe('guide-avs.pdf');

		await corpus.action(card, 'Supprimer').click();

		await expect(page.getByText('Document supprimé avec succès')).toBeVisible();
		await expect(card).toHaveCount(0);
		await expect(corpus.document('memo.pdf')).toBeVisible();
		expect(backend.requestsTo('DELETE', '/documents/user-docs')).toEqual([expect.objectContaining({query: {filename: 'guide-avs.pdf'}})]);
	});

	test('les actions du corpus ont des libellés et des noms accessibles traduits', async ({page, backend}) => {
		await PersonalDocuments.install(backend, [aPersonalDocument({title: 'guide-avs.pdf'})]);
		const corpus = new CorpusPage(page);
		await corpus.open();

		await corpus.chooseFiles(aPdf('memo.pdf'));
		await expect(corpus.uploadButton).toHaveAccessibleName('Téléverser 1 document(s)');
		await expect(corpus.uploadButton).toContainText('Téléverser');
		await expect(page.getByRole('button', {name: 'Retirer memo.pdf'})).toBeVisible();
		await expect(page.getByRole('button', {name: 'Actualiser mes documents'})).toBeVisible();
		const card = corpus.document('guide-avs.pdf');
		await expect(corpus.action(card, 'Ouvrir')).toHaveAccessibleName('Ouvrir guide-avs.pdf');
		await expect(corpus.action(card, 'Télécharger')).toHaveAccessibleName('Télécharger guide-avs.pdf');
		await expect(corpus.action(card, 'Supprimer')).toHaveAccessibleName('Supprimer guide-avs.pdf');
	});
});

test.describe('Corpus : sources officielles et demandes', () => {
	const now = new Date().toISOString();
	const aWorkspace = (workspace: Partial<WorkspaceDto>): WorkspaceDto => ({
		id: 1,
		name: 'GENERAL',
		hypotheticalQuestions: [],
		sources: [],
		createdAt: now,
		updatedAt: now,
		...workspace
	});
	const aSource = (source: Partial<SourceDto>): SourceDto => ({
		id: 1,
		name: 'zas_website',
		hypotheticalQuestions: [],
		contents: [],
		createdAt: now,
		updatedAt: now,
		...source
	});

	test('parcourt les workspaces, leurs sources et leurs contenus', async ({page, backend}) => {
		await backend.collection('/workspaces', 'name', [
			aWorkspace({id: 2, name: 'Cotisations', description: 'Questions sur les cotisations AVS', sources: ['zas_website']}),
			aWorkspace({id: 1, name: 'GENERAL'})
		]);
		await backend.collection('/sources', 'name', [
			aSource({id: 1, name: 'zas_website', contents: [{title: 'Cotisations des indépendants'}, {url: 'https://www.zas.admin.ch/taux'}]}),
			aSource({id: 2, name: 'ahv_iv_mementos', description: 'Mémentos officiels'})
		]);
		const corpus = new CorpusPage(page);
		await corpus.open();

		await corpus.openTab('Sources officielles');

		const sources = corpus.tabPanel('Sources officielles');
		await expect(sources.locator('mat-expansion-panel-header').filter({visible: true})).toHaveText([
			/Général\s+Toutes les sources/,
			/Cotisations\s+1 source\(s\)/
		]);

		await corpus.panelHeader(/Cotisations/).click();
		await expect(sources.getByText('Questions sur les cotisations AVS')).toBeVisible();
		await corpus.panelHeader('Site Web CdC').first().click();
		const contents = sources.getByRole('list').filter({hasText: 'Cotisations des indépendants'});
		await expect(contents.getByRole('listitem')).toHaveText(['Cotisations des indépendants', 'https://www.zas.admin.ch/taux']);

		// « Général » regroupe aussi les sources sans workspace.
		await corpus.panelHeader(/Général/).click();
		await corpus.panelHeader('Mémentos AVS/AI').click();
		await expect(sources.getByText('Mémentos officiels')).toBeVisible();
		await expect(sources.getByText('Aucun contenu disponible')).toBeVisible();
		expect(backend.requestsTo('GET', /^\/sources\/.+/).map(request => request.path)).toEqual(['/sources/zas_website', '/sources/ahv_iv_mementos']);
	});

	test('crée puis supprime une demande d’ajout de source', async ({page, backend}) => {
		const requests = await backend.collection<ISourceRequest>('/source-requests', 'id', [], body => ({
			...body,
			id: 7,
			sourceName: body.sourceName ?? '',
			description: body.description ?? '',
			status: 'WAITING' as ISourceRequest['status'],
			createdAt: new Date()
		}));
		await backend.on('GET', '/source-requests/my', () => ({json: requests.items}));
		const corpus = new CorpusPage(page);
		await corpus.open();
		await corpus.openTab('Mes demandes de sources');
		const tab = corpus.tabPanel('Mes demandes de sources');
		await expect(tab.getByText('Aucune demande de source en cours')).toBeVisible();

		await tab.getByRole('button', {name: 'Nouvelle demande'}).first().click();
		const dialog = page.getByRole('dialog', {name: "Demander l'ajout d'une source"});
		const sourceName = dialog.getByRole('textbox', {name: 'Nom de la source'});
		// Attendre le focus initial de la boîte de dialogue : posé après coup, il détournerait la saisie suivante.
		await expect(sourceName).toBeFocused();
		await sourceName.fill('Directives AI 2026');
		await dialog.getByRole('textbox', {name: 'Instructions pour les administrateurs'}).fill('Publiées sur le site de l’OFAS.');
		await dialog.getByRole('button', {name: 'Envoyer la demande'}).click();

		await expect(page.getByText('Demande créée avec succès')).toBeVisible();
		await expect(dialog).toBeHidden();
		const card = page.locator('mat-card').filter({hasText: 'Directives AI 2026'});
		await expect(card).toContainText('En attente');
		await expect(card).toContainText('Publiées sur le site de l’OFAS.');
		expect(backend.requestsTo('POST', '/source-requests')).toEqual([
			expect.objectContaining({body: {sourceName: 'Directives AI 2026', description: 'Publiées sur le site de l’OFAS.'}})
		]);

		await corpus.action(card, 'Supprimer la demande').click();

		await expect(page.getByText('Demande supprimée avec succès')).toBeVisible();
		await expect(card).toHaveCount(0);
		await expect(tab.getByText('Aucune demande de source en cours')).toBeVisible();
		expect(backend.requestsTo('DELETE', '/source-requests/7')).toHaveLength(1);
	});
});

// Les routes du corpus sont simulées : aucune requête documents/sources/workspaces ne doit tomber dans le filet générique.
test.afterEach(({backend}) => expect(backend.unexpected.filter(request => /documents|sources|source-requests|workspaces/.test(request))).toEqual([]));
