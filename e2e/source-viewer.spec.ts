import {Locator, Page} from '@playwright/test';
import {expect, test} from './support/mock-backend';
import {ChatPage} from './support/chat-page';
import {textPdf} from './support/pdf';
import {streamEvents} from '../src/testing/stream-events';
import {MessageSource} from '../src/app/shared/model/chat-history';

test.describe('Panneau des sources', () => {
	const guide: Partial<MessageSource> = {documentId: 'chunk-1', type: 'FILE', link: 'directives/guide-avs.pdf', pageNumber: '2'};
	const memento: Partial<MessageSource> = {documentId: 'chunk-2', type: 'URL', link: 'https://www.ahv-iv.ch/fr/memento.pdf', pageNumber: '3'};
	const retired: Partial<MessageSource> = {documentId: 'chunk-3', type: 'FILE', link: 'ancienne-directive.pdf', pageNumber: undefined};
	const excerpt = 'Le delai de recours est de 30 jours.';

	const panel = (page: Page): Locator => page.locator('zco-source-viewer-panel');

	test.beforeEach(({backend}) => {
		backend.reply(
			streamEvents.start(),
			streamEvents.citation(1, guide),
			streamEvents.text('Le délai est de 30 jours [^1]'),
			streamEvents.citation(2, memento),
			streamEvents.text(', voir le mémento [^2]'),
			streamEvents.citation(3, retired),
			streamEvents.text(' et l’ancienne directive [^3].'),
			streamEvents.source({...guide, citation: 1}),
			streamEvents.source({...memento, citation: 2}),
			streamEvents.source({...retired, citation: 3}),
			streamEvents.done()
		);
		backend.sourceViews.set('chunk-1', {
			id: 'chunk-1',
			origin: 'DOCUMENT',
			display: 'PDF',
			title: 'guide-avs.pdf',
			pageNumber: '2',
			subsection: '2.1 Délais',
			excerpt,
			excerptTruncated: false,
			fileAvailable: true
		});
		backend.sourceFiles.set('chunk-1', {body: textPdf(['Introduction', excerpt, 'Annexe']), contentType: 'application/pdf'});
		backend.sourceViews.set('chunk-2', {
			id: 'chunk-2',
			origin: 'DOCUMENT',
			display: 'URL',
			title: 'Mémento AVS',
			url: 'https://www.ahv-iv.ch/fr/memento.pdf',
			pageNumber: '3',
			excerpt: 'Extrait du mémento.',
			excerptTruncated: false,
			fileAvailable: false
		});
	});

	test.slow();

	test('ouvre le PDF cité à la bonne page, avec le passage surligné, et rend le focus à la fermeture', async ({page}) => {
		const chat = new ChatPage(page);
		await chat.open();
		await chat.ask('Quel est le délai ?');

		const pill = chat.timeline.getByRole('button', {name: 'Source 1 : guide-avs.pdf'});
		await pill.click();

		const viewer = panel(page);
		await expect(viewer.getByRole('heading', {level: 2})).toContainText('guide-avs.pdf');
		await expect(viewer.getByRole('heading', {level: 2})).toBeFocused();
		await expect(viewer).toContainText('2.1 Délais');
		// Premier rendu : chargement de pdf.js (chunk à la demande) et de son worker.
		await expect(viewer.getByRole('toolbar')).toContainText('Page 2 sur 3', {timeout: 30_000});
		await expect(viewer.locator('.textLayer .highlight')).toContainText('Le delai de recours');
		await expect(viewer.getByText('Passage cité non repéré')).toHaveCount(0);

		await viewer.getByRole('button', {name: 'Page suivante'}).click();
		await expect(viewer.getByRole('toolbar')).toContainText('Page 3 sur 3');
		await expect(viewer.locator('.textLayer')).toContainText('Annexe');

		await page.keyboard.press('Escape');
		await expect(viewer).toBeHidden();
		await expect(pill).toBeFocused();
	});

	test('navigue entre les sources : page d’origine d’une URL et source devenue inaccessible', async ({page}) => {
		const chat = new ChatPage(page);
		await chat.open();
		await chat.ask('Quel est le délai ?');

		await chat.timeline.getByRole('button', {name: /^Source 2 :/}).click();

		const viewer = panel(page);
		await expect(viewer.getByRole('heading', {level: 2})).toContainText('Mémento AVS');
		await expect(viewer.getByText('2 / 3')).toBeVisible();
		await expect(viewer.getByRole('link', {name: 'Ouvrir la page d’origine'})).toHaveAttribute('href', 'https://www.ahv-iv.ch/fr/memento.pdf#page=3');
		await expect(viewer.locator('blockquote')).toHaveText('Extrait du mémento.');

		await viewer.getByRole('button', {name: 'Source suivante'}).click();
		await expect(viewer.getByText('3 / 3')).toBeVisible();
		await expect(viewer).toContainText('Cette source n’est plus disponible ou vous n’y avez pas accès.');
		await expect(viewer.getByRole('button', {name: 'Source suivante'})).toBeDisabled();

		await viewer.getByRole('button', {name: 'Fermer le panneau des sources'}).click();
		await expect(viewer).toBeHidden();
	});
});
