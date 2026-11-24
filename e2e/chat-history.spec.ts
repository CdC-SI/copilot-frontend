import {expect, test} from './support/mock-backend';
import {ChatPage} from './support/chat-page';
import {aChatTitle, aConversation, aHistoryMessage} from '../src/testing/fixtures';
import {answerTurn} from '../src/testing/stream-events';

/** Midi local, `days` jours avant aujourd'hui : loin des changements de jour pendant le test. */
const daysAgo = (days: number): Date => {
	const date = new Date();
	return new Date(date.getFullYear(), date.getMonth(), date.getDate() - days, 12);
};

test.describe('Historique des conversations', () => {
	test.beforeEach(({backend}) => {
		backend.titles = [
			aChatTitle({conversationId: 'c1', title: 'Rente de vieillesse', timestamp: new Date()}),
			aChatTitle({conversationId: 'c2', title: 'Allocations familiales', timestamp: daysAgo(1)})
		];
		backend.conversations.set('c1', aConversation('c1', 'Quel est l’âge de la retraite ?', 'L’âge de référence est de 65 ans.'));
		backend.conversations.set('c2', aConversation('c2', 'Montant des allocations ?', 'Au moins 215 francs par mois.'));
	});

	test('regroupe les conversations par période', async ({page, backend}) => {
		backend.titles.push(
			aChatTitle({conversationId: 'c3', title: 'Cotisations AVS', timestamp: daysAgo(3)}),
			aChatTitle({conversationId: 'c4', title: 'Assurance invalidité', timestamp: daysAgo(30)})
		);
		const chat = new ChatPage(page);
		await chat.open();

		await expect(chat.sidebar.getByRole('heading', {level: 3})).toHaveText(["Aujourd'hui", 'Hier', '7 derniers jours', 'Plus ancien']);
		await expect(chat.historyGroup("Aujourd'hui").getByRole('listitem')).toContainText(['Rente de vieillesse']);
		await expect(chat.historyGroup('Hier').getByRole('listitem')).toContainText(['Allocations familiales']);
		await expect(chat.historyGroup('7 derniers jours').getByRole('listitem')).toContainText(['Cotisations AVS']);
		await expect(chat.historyGroup('Plus ancien').getByRole('listitem')).toContainText(['Assurance invalidité']);
	});

	test('rouvre une conversation avec ses citations et ses sources, puis la poursuit', async ({page, backend}) => {
		backend.conversations.set('c1', {
			conversationId: 'c1',
			attachments: [],
			messages: [
				aHistoryMessage({messageId: 'q1', message: 'Quel est le délai de recours ?', role: 'USER'}),
				aHistoryMessage({
					messageId: 'a1',
					role: 'LLM',
					message: 'Le délai est de 30 jours [^1].',
					sources: [{type: 'FILE', link: 'directives/guide-avs.pdf', documentId: 'chunk-1', pageNumber: '4', citation: 1}],
					interrupted: true
				})
			]
		});
		backend.reply(...answerTurn('Il court dès la notification.', {conversationId: 'c1', messageId: 'a2'}));
		const chat = new ChatPage(page);
		await chat.open();

		await chat.openConversation('Rente de vieillesse');

		const answer = chat.answers.last();
		await expect(answer.getByRole('button', {name: 'Source 1 : guide-avs.pdf'})).toHaveText('1');
		await expect(answer.getByRole('button', {name: 'Sources (1)'})).toBeVisible();
		await expect(answer.getByText('Réponse interrompue')).toBeVisible();
		await expect(chat.historyItem('Rente de vieillesse')).toHaveClass(/title-selected/);

		await chat.ask('Depuis quand court-il ?');

		await expect(chat.answers.last()).toContainText('Il court dès la notification.');
		await expect(chat.answers).toHaveCount(2);
		expect(backend.chatRequests).toEqual([expect.objectContaining({query: 'Depuis quand court-il ?', conversationId: 'c1'})]);
	});

	test('renomme une conversation avec Entrée, et Échap annule la saisie', async ({page, backend}) => {
		const chat = new ChatPage(page);
		await chat.open();

		await chat.renameConversation('Rente de vieillesse', 'Âge de la retraite');

		await expect(chat.historyItem('Âge de la retraite')).toBeVisible();
		await expect(chat.historyItem('Rente de vieillesse')).toHaveCount(0);
		expect(backend.requestsTo('PUT', '/conversations/titles/c1')).toEqual([expect.objectContaining({body: {newTitle: 'Âge de la retraite'}})]);

		await chat.renameConversation('Allocations familiales', 'Titre abandonné', 'Escape');

		await expect(chat.renameInput).toHaveCount(0);
		await expect(chat.historyItem('Allocations familiales')).toBeVisible();
		expect(backend.requestsTo('PUT', /^\/conversations\/titles\//)).toHaveLength(1);
	});

	test('supprime la conversation ouverte : elle quitte l’historique et le chat repart de zéro', async ({page, backend}) => {
		const chat = new ChatPage(page);
		await chat.open();
		await chat.openConversation('Rente de vieillesse');
		await expect(chat.timeline.getByText('L’âge de référence est de 65 ans.')).toBeVisible();

		await chat.deleteConversation('Rente de vieillesse');

		await expect(chat.historyItem('Rente de vieillesse')).toHaveCount(0);
		await expect(chat.timeline.getByRole('heading', {name: 'Bonjour Ada'})).toBeVisible();
		await expect(chat.answers).toHaveCount(0);
		expect(backend.requestsTo('DELETE', '/conversations/c1')).toHaveLength(1);
	});

	test('supprimer une autre conversation garde la conversation ouverte', async ({page, backend}) => {
		const chat = new ChatPage(page);
		await chat.open();
		await chat.openConversation('Rente de vieillesse');
		await expect(chat.timeline.getByText('L’âge de référence est de 65 ans.')).toBeVisible();

		await chat.deleteConversation('Allocations familiales');

		await expect(chat.historyItem('Allocations familiales')).toHaveCount(0);
		await expect(chat.timeline.getByText('L’âge de référence est de 65 ans.')).toBeVisible();
		expect(backend.requestsTo('DELETE', '/conversations/c2')).toHaveLength(1);
	});

	test('« Nouvelle conversation » vide le fil et la question suivante ouvre une autre conversation', async ({page, backend}) => {
		backend.reply(...answerTurn('Réponse dans la nouvelle conversation.'));
		const chat = new ChatPage(page);
		await chat.open();
		await chat.openConversation('Rente de vieillesse');
		await expect(chat.timeline.getByText('L’âge de référence est de 65 ans.')).toBeVisible();

		await chat.newConversation();

		await expect(chat.timeline.getByRole('heading', {name: 'Bonjour Ada'})).toBeVisible();
		await expect(chat.composer).toBeFocused();
		await expect(chat.historyItem('Rente de vieillesse')).not.toHaveClass(/title-selected/);

		await chat.ask('Nouvelle question');

		await expect(chat.answers.last()).toContainText('Réponse dans la nouvelle conversation.');
		await expect(chat.historyItem('Nouvelle question')).toBeVisible();
		const [{conversationId}] = backend.chatRequests;
		expect(conversationId).toBeTruthy();
		expect(['c1', 'c2']).not.toContain(conversationId);
	});
});

// Les routes de l'historique sont toutes simulées : aucune requête de ce type ne doit tomber dans le filet générique.
test.afterEach(({backend}) => expect(backend.unexpected.filter(request => request.includes('conversations'))).toEqual([]));
