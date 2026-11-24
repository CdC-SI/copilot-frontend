import {expect, test} from './support/mock-backend';
import {ChatPage} from './support/chat-page';
import {streamEvents} from '../src/testing/stream-events';
import {MessageSource} from '../src/app/shared/model/chat-history';

test.describe('Citations', () => {
	const guide: Partial<MessageSource> = {documentId: 'chunk-1', type: 'FILE', link: 'directives/guide-avs.pdf', pageNumber: '4', subsection: '2.1 Délais'};
	// Sans identifiant, la source ne s'ouvre pas dans le panneau : la carte de la liste reçoit le focus.
	const memento: Partial<MessageSource> = {documentId: undefined, type: 'URL', link: 'https://www.ahv-iv.ch/fr/memento', pageNumber: undefined};

	test.beforeEach(({backend}) => {
		backend.reply(
			streamEvents.start(),
			streamEvents.citation(1, guide),
			streamEvents.text('Le délai est de 30 jours [^1]'),
			streamEvents.citation(2, memento),
			streamEvents.text('. Voir aussi le mémento [^2].'),
			streamEvents.source({...guide, citation: 1}),
			streamEvents.source({...memento, citation: 2}),
			streamEvents.source({documentId: 'chunk-3', link: 'autre-document.pdf'}),
			streamEvents.done()
		);
	});

	test('affiche les citations en pastilles avec un aperçu de la source', async ({page}) => {
		const chat = new ChatPage(page);
		await chat.open();
		await chat.ask('Quel est le délai ?');

		const first = chat.timeline.getByRole('button', {name: 'Source 1 : guide-avs.pdf'});
		await expect(first).toHaveText('1');
		await expect(chat.timeline.getByRole('button', {name: 'Source 2 : ahv-iv.ch/fr/memento'})).toBeVisible();
		await expect(chat.timeline.getByText('[^1]')).toHaveCount(0);

		await first.hover();
		const card = page.getByRole('tooltip');
		await expect(card).toContainText('guide-avs.pdf');
		await expect(card).toContainText('2.1 Délais');
		await expect(first).toHaveAttribute('aria-describedby', (await card.getAttribute('id')) ?? '');

		await page.keyboard.press('Escape');
		await chat.composer.hover();
		await expect(card).toBeHidden();
	});

	test('un clic sur une pastille ouvre les sources, citées d’abord, et met la source en évidence', async ({page}) => {
		const chat = new ChatPage(page);
		await chat.open();
		await chat.ask('Quel est le délai ?');

		await chat.timeline.getByRole('button', {name: 'Source 2 : ahv-iv.ch/fr/memento'}).click();

		const cards = chat.timeline.locator('.source-card');
		await expect(cards).toHaveCount(3);
		await expect(cards.nth(0)).toContainText('guide-avs.pdf');
		await expect(cards.nth(1)).toContainText('ahv-iv.ch');
		await expect(cards.nth(2)).toContainText('autre-document.pdf');
		await expect(cards.nth(1)).toHaveClass(/highlighted/);
		await expect(cards.nth(1)).toBeFocused();
		await expect(cards.nth(0).getByLabel('Source citée n° 1')).toBeVisible();
	});
});
