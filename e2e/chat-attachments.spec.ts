import {expect, gate, test} from './support/mock-backend';
import {AttachmentFile, ChatPage} from './support/chat-page';
import {anAttachmentDto, anAttachmentUploadResponse} from '../src/testing/fixtures';
import {answerTurn} from '../src/testing/stream-events';

test.describe('Pièces jointes', () => {
	// 24 000 octets : affiché « 24 Ko » une fois traité (taille du fichier local).
	const contract: AttachmentFile = {name: 'contrat.txt', mimeType: 'text/plain', buffer: Buffer.alloc(24_000, 'a')};

	test('ajoute un fichier : envoi, analyse en cours puis traité, et la question suivante porte sur la conversation créée', async ({page, backend}) => {
		const upload = gate();
		backend.attachmentReplies.push({
			json: anAttachmentUploadResponse('c-att', [anAttachmentDto({id: 7, filename: 'contrat.txt', status: 'PENDING'})]),
			release: upload.promise
		});
		backend.attachmentStatuses.push(anAttachmentUploadResponse('c-att', [anAttachmentDto({id: 7, filename: 'contrat.txt'})]));
		backend.reply(...answerTurn('Le préavis est de trois mois.', {conversationId: 'c-att'}));
		const chat = new ChatPage(page);
		await chat.open();

		await chat.attach(contract);

		const chip = chat.attachments.filter({hasText: 'contrat.txt'});
		await expect(chip).toContainText('Analyse et extraction en cours...');
		// Envoi en cours : la question ne peut pas encore être envoyée.
		await chat.composer.fill('Quel est le préavis ?');
		await expect(chat.sendButton).toBeDisabled();

		upload.open();

		await expect(chip).toContainText('contrat.txt (24 Ko)');
		await expect(chip).not.toContainText('Analyse et extraction en cours');
		await expect(page.getByText('Pièces jointes traitées avec succès')).toBeVisible();
		expect(backend.attachmentUploads).toEqual([{conversationId: undefined, files: ['contrat.txt']}]);

		await expect(chat.sendButton).toBeEnabled();
		await chat.composer.press('Enter');
		await expect(chat.answers.last()).toContainText('Le préavis est de trois mois.');
		expect(backend.chatRequests).toEqual([expect.objectContaining({query: 'Quel est le préavis ?', conversationId: 'c-att'})]);
	});

	test('un traitement en échec est signalé et peut être relancé', async ({page, backend}) => {
		backend.attachmentReplies.push(
			{json: anAttachmentUploadResponse('c-att', [anAttachmentDto({id: 7, filename: 'contrat.txt', status: 'FAILED', errorCode: 'EMBEDDING_TIMEOUT'})])},
			{json: anAttachmentUploadResponse('c-att', [anAttachmentDto({id: 7, filename: 'contrat.txt'})])}
		);
		const chat = new ChatPage(page);
		await chat.open();

		await chat.attach(contract);

		const chip = chat.attachments.filter({hasText: 'contrat.txt'});
		await expect(chip.getByRole('alert')).toHaveText("L'analyse du document a pris trop de temps, veuillez le téléverser à nouveau");
		await expect(page.getByText('Erreur lors du traitement des pièces jointes')).toBeVisible();

		await chip.getByRole('button', {name: 'Réessayer'}).click();

		await expect(chip.getByRole('alert')).toHaveCount(0);
		await expect(chip.getByRole('button', {name: 'Réessayer'})).toHaveCount(0);
		await expect(chip).toContainText('contrat.txt (24 Ko)');
		expect(backend.attachmentUploads).toEqual([
			{conversationId: undefined, files: ['contrat.txt']},
			{conversationId: 'c-att', files: ['contrat.txt']}
		]);
	});
});

// Les routes du chat et des sources sont toutes simulées : aucune requête de ce type ne doit tomber dans le filet générique.
test.afterEach(({backend}) => expect(backend.unexpected.filter(request => /conversations|documents/.test(request))).toEqual([]));
