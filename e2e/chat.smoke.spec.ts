import {expect, test} from './support/mock-backend';
import {ChatPage} from './support/chat-page';
import {aChatTitle, aConversation} from '../src/testing/fixtures';
import {answerTurn, streamEvents} from '../src/testing/stream-events';

test.describe('Chat (smoke)', () => {
	test('pose une question et affiche la réponse rendue en Markdown', async ({page, backend}) => {
		backend.reply(...answerTurn('L’âge de référence est de **65 ans** pour tous.'));
		const chat = new ChatPage(page);

		await chat.open();
		await chat.ask('Quel est l’âge de la retraite ?');

		await expect(chat.timeline.getByText('Quel est l’âge de la retraite ?')).toBeVisible();
		await expect(chat.timeline.locator('strong', {hasText: '65 ans'})).toBeVisible();
		expect(backend.chatRequests).toEqual([expect.objectContaining({query: 'Quel est l’âge de la retraite ?'})]);
	});

	test('affiche la réponse au fil du flux, avant sa fin', async ({page, backend}) => {
		const stream = await backend.manualStream();
		const chat = new ChatPage(page);

		await chat.open();
		await chat.ask('Quel est l’âge de la retraite ?');
		await stream.send(streamEvents.start(), streamEvents.text('L’âge de référence '));

		await expect(chat.timeline.getByText('L’âge de référence')).toBeVisible();
		await expect(chat.stopButton).toBeVisible();

		await stream.send(streamEvents.text('est de 65 ans.'), streamEvents.done());
		await stream.close();

		await expect(chat.timeline.getByText('L’âge de référence est de 65 ans.')).toBeVisible();
		await expect(chat.stopButton).toBeHidden();
	});

	test('rouvre une conversation de l’historique', async ({page, backend}) => {
		backend.titles = [aChatTitle({conversationId: 'c1', title: 'Rente de vieillesse'})];
		backend.conversations.set('c1', aConversation('c1', 'Question enregistrée', 'Réponse enregistrée'));
		const chat = new ChatPage(page);

		await chat.open();
		await chat.openConversation('Rente de vieillesse');

		await expect(chat.timeline.getByText('Question enregistrée')).toBeVisible();
		await expect(chat.timeline.getByText('Réponse enregistrée')).toBeVisible();
	});
});
