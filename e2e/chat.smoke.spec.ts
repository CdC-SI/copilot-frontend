import {expect, test} from './support/mock-backend';
import {ChatPage} from './support/chat-page';
import {aChatTitle, aConversation} from '../src/testing/fixtures';
import {answerTurn} from '../src/testing/stream-events';

test.describe('Chat (smoke)', () => {
	test('pose une question et affiche la réponse en streaming', async ({page, backend}) => {
		backend.reply(...answerTurn('L’âge de référence est de **65 ans** pour tous.'));
		const chat = new ChatPage(page);

		await chat.open();
		await chat.ask('Quel est l’âge de la retraite ?');

		await expect(chat.timeline.getByText('Quel est l’âge de la retraite ?')).toBeVisible();
		await expect(chat.timeline.getByText('65 ans')).toBeVisible();
		expect(backend.chatRequests).toEqual([expect.objectContaining({query: 'Quel est l’âge de la retraite ?'})]);
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
