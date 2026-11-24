import {expect, test} from './support/mock-backend';
import {ChatPage} from './support/chat-page';
import {streamEvents} from '../src/testing/stream-events';

test.describe('Étapes d’outils', () => {
	test('affiche les appels d’outils en cours puis leur résultat, repliés sous un résumé à la fin de la réponse', async ({page, backend}) => {
		const stream = await backend.manualStream();
		const chat = new ChatPage(page);
		await chat.open();
		await chat.ask('Quel est le délai de recours ?');

		await stream.send(streamEvents.start(), streamEvents.toolCall('t1', 'search_social_insurance_documentation', {query: 'délai de recours'}));
		const steps = chat.toolSteps(chat.answers.last());
		const search = steps.getByRole('listitem').filter({hasText: 'Recherche dans la documentation'});
		await expect(search).toContainText('en cours');
		// Une seule étape : pas de résumé repliable.
		await expect(steps.getByRole('button', {name: /étapes/})).toHaveCount(0);

		await stream.send(streamEvents.toolResult('t1', 'search_social_insurance_documentation', 'ok', 3));
		await expect(search).toContainText('terminé');
		await expect(search).toContainText('3 documents');

		await stream.send(streamEvents.toolCall('t2', 'get_documents', {ids: ['d1', 'd2']}));
		const summary = steps.getByRole('button', {name: '2 étapes'});
		await expect(summary).toHaveAttribute('aria-expanded', 'true');
		const reading = steps.getByRole('listitem').filter({hasText: 'Lecture de documents'});
		await expect(reading).toContainText('en cours');

		await stream.send(
			streamEvents.toolResult('t2', 'get_documents', 'no_result'),
			streamEvents.text('Le délai de recours est de 30 jours.'),
			streamEvents.done()
		);
		await stream.close();

		await expect(chat.answers.last()).toContainText('Le délai de recours est de 30 jours.');
		// Réponse terminée : la liste se replie derrière le résumé.
		await expect(summary).toHaveAttribute('aria-expanded', 'false');
		await expect(steps.getByRole('listitem')).toHaveCount(0);

		await summary.click();
		await expect(summary).toHaveAttribute('aria-expanded', 'true');
		await expect(steps.getByRole('listitem')).toHaveCount(2);
		await expect(reading).toContainText('aucun résultat');
	});

	test('une étape restée en cours est annulée à la fin de la réponse', async ({page, backend}) => {
		backend.reply(streamEvents.start(), streamEvents.toolCall('t1', 'custom_lookup'), streamEvents.text('Réponse sans résultat d’outil.'), streamEvents.done());
		const chat = new ChatPage(page);
		await chat.open();
		await chat.ask('Question');

		const step = chat.toolSteps(chat.answers.last()).getByRole('listitem');
		await expect(step).toContainText('Outil « custom_lookup »');
		await expect(step).toContainText('annulé');
	});
});

test.describe('Approbation d’un outil', () => {
	const tool = 'Lecture d’une pièce jointe';

	test('autoriser envoie la décision au backend, puis l’étape reprend jusqu’à son résultat', async ({page, backend}) => {
		const stream = await backend.manualStream();
		const chat = new ChatPage(page);
		await chat.open();
		await chat.ask('Résume le contrat joint');

		await stream.send(streamEvents.start(), streamEvents.approvalRequired('t1', 'ap-1', 'get_attachment_content', {attachment: 'contrat.pdf'}));
		const steps = chat.toolSteps(chat.answers.last());
		await expect(steps.getByRole('listitem')).toContainText('en attente d’autorisation');
		const card = steps.getByRole('region', {name: 'Autorisation requise'});
		await expect(card).toContainText(`L’assistant souhaite utiliser l’outil « ${tool} ».`);
		await expect(card.getByRole('definition')).toHaveText('contrat.pdf');
		await expect(card).toContainText(/Expire dans \d+ s/);

		await card.getByRole('button', {name: `Autoriser l’outil « ${tool} »`}).click();

		await expect(card.getByRole('status')).toHaveText('Autorisé');
		await expect(card.getByRole('button')).toHaveCount(0);
		const [{conversationId}] = await stream.requests();
		expect(backend.approvalDecisions).toEqual([{conversationId, approvalId: 'ap-1', decision: 'APPROVE'}]);

		await stream.send(streamEvents.toolResult('t1', 'get_attachment_content', 'ok', 1));
		await expect(steps.getByRole('listitem')).toContainText('terminé');
		await stream.send(streamEvents.text('Le contrat prévoit un préavis de 3 mois.'), streamEvents.done());
		await stream.close();

		await expect(chat.answers.last()).toContainText('Le contrat prévoit un préavis de 3 mois.');
		// Réponse terminée : la carte d'approbation disparaît, l'étape reste affichée.
		await expect(card).toBeHidden();
		await expect(steps.getByRole('listitem')).toContainText('terminé');
	});

	test('refuser envoie la décision et l’étape passe à « refusé »', async ({page, backend}) => {
		const stream = await backend.manualStream();
		const chat = new ChatPage(page);
		await chat.open();
		await chat.ask('Résume le contrat joint');

		await stream.send(streamEvents.start(), streamEvents.approvalRequired('t1', 'ap-2', 'get_attachment_content'));
		const steps = chat.toolSteps(chat.answers.last());
		const card = steps.getByRole('region', {name: 'Autorisation requise'});
		await card.getByRole('button', {name: `Refuser l’outil « ${tool} »`}).click();

		await expect(card.getByRole('status')).toHaveText('Refusé');
		expect(backend.approvalDecisions).toEqual([expect.objectContaining({approvalId: 'ap-2', decision: 'REJECT'})]);

		await stream.send(streamEvents.toolResult('t1', 'get_attachment_content', 'rejected'));
		await expect(steps.getByRole('listitem')).toContainText('refusé');
	});

	test('une demande inconnue du backend (404) est signalée expirée ou déjà traitée', async ({page, backend}) => {
		backend.approvalStatus = 404;
		const stream = await backend.manualStream();
		const chat = new ChatPage(page);
		await chat.open();
		await chat.ask('Résume le contrat joint');

		await stream.send(streamEvents.start(), streamEvents.approvalRequired('t1', 'ap-3', 'get_attachment_content'));
		const card = chat.toolSteps(chat.answers.last()).getByRole('region', {name: 'Autorisation requise'});
		await card.getByRole('button', {name: `Autoriser l’outil « ${tool} »`}).click();

		await expect(card.getByRole('status')).toHaveText('Demande expirée ou déjà traitée');
		expect(backend.approvalDecisions).toHaveLength(1);
	});
});

// Les routes du chat et des sources sont toutes simulées : aucune requête de ce type ne doit tomber dans le filet générique.
test.afterEach(({backend}) => expect(backend.unexpected.filter(request => /conversations|documents/.test(request))).toEqual([]));
