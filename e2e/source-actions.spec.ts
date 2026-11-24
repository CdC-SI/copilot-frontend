import {Locator, Page} from '@playwright/test';
import {expect, test} from './support/mock-backend';
import {ChatPage} from './support/chat-page';
import {textPdf} from './support/pdf';
import {streamEvents} from '../src/testing/stream-events';
import {MessageSource} from '../src/app/shared/model/chat-history';

/** Actions sur les sources d'une réponse : téléchargement, ouverture dans un onglet, liens externes. */
test.describe('Actions des sources', () => {
	const guide: Partial<MessageSource> = {documentId: 'chunk-1', type: 'FILE', link: 'directives/guide-avs.pdf', pageNumber: '1'};
	const scale: Partial<MessageSource> = {documentId: 'chunk-2', type: 'FILE', link: 'baremes/bareme-2026.docx', pageNumber: undefined};
	// Sans identifiant : la source ne s'ouvre pas dans le panneau (lien direct ou téléchargement par nom).
	const memento: Partial<MessageSource> = {documentId: undefined, type: 'URL', link: 'https://www.ahv-iv.ch/fr/memento', pageNumber: undefined};
	const circular: Partial<MessageSource> = {documentId: undefined, type: 'FILE', link: 'circulaires/circulaire-12.docx', pageNumber: undefined};
	const pdf = textPdf(['Le delai de recours est de 30 jours.']);
	const docx = Buffer.from('contenu du barème');
	const docxType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

	const panel = (page: Page): Locator => page.locator('zco-source-viewer-panel');

	test.beforeEach(({backend}) => {
		backend.reply(
			streamEvents.start(),
			streamEvents.citation(1, guide),
			streamEvents.text('Le délai est de 30 jours [^1]'),
			streamEvents.citation(2, scale),
			streamEvents.text(', voir le barème [^2].'),
			streamEvents.source({...guide, citation: 1}),
			streamEvents.source({...scale, citation: 2}),
			streamEvents.source(memento),
			streamEvents.source(circular),
			streamEvents.done()
		);
		backend.sourceViews.set('chunk-1', {
			id: 'chunk-1',
			origin: 'DOCUMENT',
			display: 'PDF',
			title: 'guide-avs.pdf',
			excerptTruncated: false,
			fileAvailable: true
		});
		backend.sourceFiles.set('chunk-1', {body: pdf, contentType: 'application/pdf'});
		backend.sourceViews.set('chunk-2', {
			id: 'chunk-2',
			origin: 'DOCUMENT',
			display: 'DOWNLOAD',
			title: 'bareme-2026.docx',
			excerptTruncated: false,
			fileAvailable: true
		});
		backend.sourceFiles.set('chunk-2', {body: docx, contentType: docxType});
		backend.documents.set('circulaires/circulaire-12.docx', {body: docx, contentType: docxType});
	});

	test('le PDF affiché dans le panneau se télécharge et s’ouvre dans un nouvel onglet', async ({page}) => {
		const chat = new ChatPage(page);
		await chat.open();
		await chat.ask('Quel est le délai ?');
		await chat.timeline.getByRole('button', {name: 'Source 1 : guide-avs.pdf'}).click();

		const viewer = panel(page);
		// Le bouton apparaît une fois le fichier chargé : le téléchargement reprend le fichier déjà reçu.
		const openInTab = viewer.getByRole('button', {name: 'Ouvrir dans un nouvel onglet'});
		await expect(openInTab).toBeVisible();

		const downloading = page.waitForEvent('download');
		await viewer.getByRole('button', {name: 'Télécharger'}).click();
		const download = await downloading;
		expect(download.suggestedFilename()).toBe('guide-avs.pdf');

		const popup = page.waitForEvent('popup');
		await openInTab.click();
		expect((await popup).url()).toMatch(/^blob:/);
	});

	test('un fichier non affichable est proposé au téléchargement depuis le panneau', async ({page}) => {
		const chat = new ChatPage(page);
		await chat.open();
		await chat.ask('Quel est le délai ?');
		await chat.timeline.getByRole('button', {name: 'Source 2 : bareme-2026.docx'}).click();

		const viewer = panel(page);
		await expect(viewer.getByRole('heading', {level: 2})).toContainText('bareme-2026.docx');
		const downloading = page.waitForEvent('download');
		await viewer.getByRole('button', {name: 'Télécharger'}).click();
		const download = await downloading;

		expect(download.suggestedFilename()).toBe('bareme-2026.docx');
	});

	test('dans la liste, une source URL sans identifiant est un lien externe et un fichier se télécharge par son nom', async ({page}) => {
		const chat = new ChatPage(page);
		await chat.open();
		await chat.ask('Quel est le délai ?');
		await chat.timeline.getByRole('button', {name: 'Sources (4)'}).click();

		const link = chat.timeline.getByRole('link', {name: /ahv-iv\.ch\/fr\/memento/});
		await expect(link).toHaveAttribute('href', 'https://www.ahv-iv.ch/fr/memento');
		await expect(link).toHaveAttribute('target', '_blank');
		await expect(link).toHaveAttribute('rel', /noopener/);

		const downloading = page.waitForEvent('download');
		await chat.timeline.getByRole('button', {name: 'circulaire-12.docx'}).click();
		const download = await downloading;
		expect(download.suggestedFilename()).toBe('circulaire-12.docx');
	});
});

// Les routes du chat et des sources sont toutes simulées : aucune requête de ce type ne doit tomber dans le filet générique.
test.afterEach(({backend}) => expect(backend.unexpected.filter(request => /conversations|documents/.test(request))).toEqual([]));
