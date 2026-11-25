import {expect, test} from './support/mock-backend';
import {ChatPage} from './support/chat-page';
import {answerTurn, streamEvents} from '../src/testing/stream-events';

test.describe('Arrêt de la génération', () => {
	test('Stop demande l’arrêt au backend, garde la réponse partielle marquée interrompue et rend la saisie', async ({page, backend}) => {
		const stream = await backend.manualStream();
		const chat = new ChatPage(page);
		await chat.open();
		await chat.ask('Explique la rente de vieillesse');

		await stream.send(streamEvents.start('g1'), streamEvents.text('La rente de vieillesse '));
		await expect(chat.answers.last()).toContainText('La rente de vieillesse');
		await expect(chat.composer).toBeDisabled();

		await chat.stopButton.click();

		// En attente de l'enregistrement de la réponse partielle par le backend.
		await expect(page.getByRole('button', {name: 'Arrêt en cours…'})).toBeDisabled();
		await expect.poll(() => backend.stopRequests).toHaveLength(1);
		const [{conversationId}] = await stream.requests();
		expect(backend.stopRequests).toEqual([{conversationId, generationId: 'g1'}]);

		await stream.send(streamEvents.done('a1', true));
		await stream.close();

		const answer = chat.answers.last();
		await expect(answer.getByText('Réponse interrompue')).toBeVisible();
		await expect(answer).toContainText('La rente de vieillesse');
		await expect(chat.stopButton).toBeHidden();
		await expect(chat.composer).toBeEnabled();
		await expect(chat.regenerateButton).toBeVisible();
	});
});

test.describe('Rejouer le dernier échange', () => {
	test('Régénérer remplace la dernière réponse enregistrée', async ({page, backend}) => {
		backend.reply(...answerTurn('Première réponse.', {messageId: 'a1'}));
		backend.reply(...answerTurn('Réponse régénérée.', {generationId: 'g2', messageId: 'a2'}));
		const chat = new ChatPage(page);
		await chat.open();
		await chat.ask('Quel est le délai ?');
		await expect(chat.answers.last()).toContainText('Première réponse.');

		await chat.regenerateButton.click();

		await expect(chat.answers).toHaveCount(1);
		await expect(chat.answers.last()).toContainText('Réponse régénérée.');
		await expect(chat.timeline.getByText('Première réponse.')).toHaveCount(0);
		const [first, second] = backend.chatRequests;
		expect(second).toEqual({query: 'Quel est le délai ?', conversationId: first.conversationId, replaceMessageId: 'a1'});
	});

	test('modifier la dernière question la renvoie et remplace sa réponse', async ({page, backend}) => {
		backend.reply(...answerTurn('Réponse sur l’AVS.', {messageId: 'a1'}));
		backend.reply(...answerTurn('Réponse sur l’AI.', {generationId: 'g2', messageId: 'a2'}));
		const chat = new ChatPage(page);
		await chat.open();
		await chat.ask('Délai de recours AVS ?');
		await expect(chat.answers.last()).toContainText('Réponse sur l’AVS.');

		await chat.editLastQuestion('Délai de recours AI ?');

		await expect(chat.questions).toHaveCount(1);
		await expect(chat.questions.last()).toContainText('Délai de recours AI ?');
		await expect(chat.answers).toHaveCount(1);
		await expect(chat.answers.last()).toContainText('Réponse sur l’AI.');
		const [first, second] = backend.chatRequests;
		expect(second).toEqual({query: 'Délai de recours AI ?', conversationId: first.conversationId, replaceMessageId: 'a1'});
	});

	test('les actions d’une réponse enregistrée sont des boutons accessibles au clavier', async ({page, backend}) => {
		backend.reply(...answerTurn('Réponse.', {messageId: 'a1'}));
		backend.reply(...answerTurn('Réponse régénérée.', {generationId: 'g2', messageId: 'a2'}));
		const chat = new ChatPage(page);
		await chat.open();
		await chat.ask('Quel est le délai ?');

		const answer = chat.answers.last();
		for (const name of ['Bonne réponse', 'Mauvaise réponse', 'Lire à haute voix', 'Copier la réponse', 'Régénérer la réponse']) {
			await expect(answer.getByRole('button', {name})).toBeVisible();
		}
		await answer.getByRole('button', {name: 'Régénérer la réponse'}).focus();
		await page.keyboard.press('Enter');
		await expect.poll(() => backend.chatRequests.length).toBe(2);
	});

	test('un refus du backend (409) rétablit l’échange précédent et prévient l’utilisateur', async ({page, backend}) => {
		backend.reply(...answerTurn('Réponse conservée.', {messageId: 'a1'}));
		backend.replyHttpError(409, 'TURN_NOT_REPLACEABLE');
		const chat = new ChatPage(page);
		await chat.open();
		await chat.ask('Quel est le délai ?');
		await expect(chat.answers.last()).toContainText('Réponse conservée.');

		await chat.regenerateButton.click();

		await expect(page.getByText('Cette réponse ne peut plus être régénérée, car la conversation a changé.', {exact: false})).toBeVisible();
		await expect(chat.answers.last()).toContainText('Réponse conservée.');
		await expect(chat.regenerateButton).toBeVisible();
		expect(backend.chatRequests).toHaveLength(2);
	});
});

test.describe('Erreurs de génération', () => {
	test('un événement « error » du flux affiche l’erreur sur la réponse et permet de régénérer', async ({page, backend}) => {
		backend.reply(streamEvents.start('g1'), streamEvents.text('Début de réponse'), streamEvents.error('LLM_UNAVAILABLE'));
		backend.reply(...answerTurn('Réponse après nouvel essai.', {generationId: 'g2', messageId: 'a2'}));
		const chat = new ChatPage(page);
		await chat.open();
		await chat.ask('Quel est le délai ?');

		const answer = chat.answers.last();
		await expect(answer).toContainText('Une erreur est survenue pendant la génération. Veuillez réessayer.');
		await expect(answer).not.toContainText('Début de réponse');
		await expect(chat.composer).toBeEnabled();
		// Rien n'a été enregistré : pas de feedback, seule la régénération est proposée.
		await expect(answer.getByRole('button', {name: 'Régénérer la réponse'})).toBeVisible();

		await chat.regenerateButton.click();

		await expect(answer).toContainText('Réponse après nouvel essai.');
		await expect(chat.answers).toHaveCount(1);
		const [first, second] = backend.chatRequests;
		expect(second).toEqual({query: 'Quel est le délai ?', conversationId: first.conversationId, replaceMessageId: undefined});
	});

	test('une erreur HTTP à l’ouverture du flux affiche l’erreur sur la réponse et permet de régénérer', async ({page, backend}) => {
		backend.replyHttpError(500);
		backend.reply(...answerTurn('Réponse après nouvel essai.', {messageId: 'a2'}));
		const chat = new ChatPage(page);
		await chat.open();
		await chat.ask('Quel est le délai ?');

		const answer = chat.answers.last();
		await expect(answer).toContainText('La réponse a été interrompue avant d’être complète. Veuillez réessayer.');
		await expect(chat.composer).toBeEnabled();

		await chat.regenerateButton.click();

		await expect(answer).toContainText('Réponse après nouvel essai.');
		expect(backend.chatRequests).toHaveLength(2);
	});

	test('une session expirée (401) est signalée sur la réponse', async ({page, backend}) => {
		backend.replyHttpError(401);
		const chat = new ChatPage(page);
		await chat.open();
		await chat.ask('Quel est le délai ?');

		await expect(chat.answers.last()).toContainText('Votre session a expiré. Reconnectez-vous puis réessayez.');
	});
});

// Les routes du chat et des sources sont toutes simulées : aucune requête de ce type ne doit tomber dans le filet générique.
test.afterEach(({backend}) => expect(backend.unexpected.filter(request => /conversations|documents/.test(request))).toEqual([]));
