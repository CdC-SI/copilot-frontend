import {ChatStreamProcessorService, StreamProcessingResult} from './chat-stream-processor.service';
import {ChatMessage} from '../../shared/model/chat-message';
import {ChatStreamEvent} from '../../shared/model/chat-stream-event';
import {ToolResultStatus} from '../../shared/model/tool-step';
import {streamEvents} from '../../../testing/stream-events';

describe('ChatStreamProcessorService', () => {
	let processor: ChatStreamProcessorService;
	let message: ChatMessage;

	/** Applique chaque événement dans son propre lot (une frame) et conserve la dernière version du message. */
	const feed = (...events: ChatStreamEvent[]): StreamProcessingResult[] =>
		events.map(event => {
			const result = processor.apply(message, [event]);
			message = result.message;
			return result;
		});
	const {text, status} = streamEvents;

	beforeEach(() => {
		processor = new ChatStreamProcessorService();
		message = {message: ''} as ChatMessage;
	});

	it("start annonce l'identifiant de génération sans terminer ni identifier la réponse", () => {
		const [result] = feed({type: 'start', data: {conversationId: 'c', messageId: 'm-1'}});
		expect(message.generationId).toBe('m-1');
		expect(message.id).toBeUndefined();
		expect(message.isCompleted).toBeFalsy();
		expect(result.completed).toBe(false);
	});

	it('affiche le statut tant que la réponse n’a pas commencé, puis le remplace par le contenu', () => {
		feed(status('retrieval', 'Recherche…'));
		expect(message.status).toBe('retrieval');
		expect(message.message).toBe('Recherche…');

		feed(status('tool_use', 'Outil'));
		expect(message.message).toBe('Outil');

		feed(text('Bonjour'), text(' monde'));
		expect(message.status).toBeUndefined();
		expect(message.message).toBe('Bonjour monde');
	});

	it('un statut reçu après le début de la réponse ne remplace pas le contenu', () => {
		feed(text('Début'), status('tool_use', 'Outil'));
		expect(message.status).toBeUndefined();
		expect(message.message).toBe('Début');
	});

	it('ajoute les sources, le workspace et remonte les suggestions', () => {
		const [, , suggestion] = feed(
			{type: 'source', data: {documentId: '1', type: 'URL', link: 'http://a', pageNumber: '2'}},
			{type: 'workspace', data: {name: 'AVS'}},
			{type: 'suggestion', data: {text: 'Q1'}}
		);
		expect(message.sources).toEqual([{documentId: '1', type: 'URL', link: 'http://a', pageNumber: '2'}]);
		expect(message.workspace).toBe('AVS');
		expect(suggestion.newSuggestions).toEqual(['Q1']);
	});

	it('done termine la réponse, l’identifie et la marque enregistrée', () => {
		Object.assign(message, {replaceableId: 'ancienne', stopping: true});
		const [, end] = feed(text('Réponse'), {type: 'done', data: {messageId: 'm-1', interrupted: false}});
		expect(end.completed).toBe(true);
		expect(message.id).toBe('m-1');
		expect(message.isCompleted).toBe(true);
		expect(message.replaceableId).toBeUndefined();
		expect(message.stopping).toBeUndefined();
		expect(message.interrupted).toBeUndefined();
		expect(message.message).toBe('Réponse');
	});

	it('done interrompu marque la réponse partielle interrompue', () => {
		feed(status('retrieval', 'Recherche…'), {type: 'done', data: {messageId: 'm-1', interrupted: true}});
		expect(message.interrupted).toBe(true);
		expect(message.message).toBe('');
		expect(message.status).toBeUndefined();
	});

	it('error signale l’échec sans terminer ni identifier la réponse', () => {
		const [, failure] = feed(status('retrieval', 'Recherche…'), {type: 'error', data: {code: 'GENERATION_FAILED'}});
		expect(failure.failed).toBe(true);
		expect(message.id).toBeUndefined();
		expect(message.status).toBeUndefined();
	});

	it('interrupt conserve la réponse partielle et la marque interrompue', () => {
		feed(text('Début de réponse'));
		message = processor.interrupt(message);
		expect(message.message).toBe('Début de réponse');
		expect(message.isCompleted).toBe(true);
		expect(message.interrupted).toBe(true);
	});

	it('interrupt efface le texte de statut si la réponse n’a pas commencé', () => {
		feed(status('retrieval', 'Recherche…'));
		message = processor.interrupt(message);
		expect(message.message).toBe('');
		expect(message.status).toBeUndefined();
		expect(message.interrupted).toBe(true);
	});

	it('applique un lot d’événements en une seule nouvelle version, sans modifier le message reçu', () => {
		const original: ChatMessage = {clientId: 'a', message: '', sources: []} as ChatMessage;
		const result = processor.apply(original, [
			text('Bon'),
			text('jour'),
			{type: 'source', data: {documentId: '1', type: 'URL', link: 'http://a'}},
			{type: 'done', data: {messageId: 'm-1', interrupted: false}}
		]);

		expect(result.message).not.toBe(original);
		expect(result.message.sources).not.toBe(original.sources);
		expect(result.message).toMatchObject({clientId: 'a', message: 'Bonjour', id: 'm-1', isCompleted: true});
		expect(result.message.sources).toHaveLength(1);
		expect(result.completed).toBe(true);
		expect(original).toEqual({clientId: 'a', message: '', sources: []});
	});

	it('interrupt renvoie une nouvelle version du message', () => {
		const original = {clientId: 'a', message: 'Partiel', stopping: true} as ChatMessage;
		const interrupted = processor.interrupt(original);
		expect(interrupted).not.toBe(original);
		expect(original.stopping).toBe(true);
		expect(original.interrupted).toBeUndefined();
	});

	describe('étapes d’outils', () => {
		const toolCall = (id: string, name = 'get_documents'): ChatStreamEvent => ({type: 'tool_call', data: {id, name, arguments: {ids: ['d1']}}});
		const toolResult = (id: string, status: ToolResultStatus = 'ok'): ChatStreamEvent => ({
			type: 'tool_result',
			data: {id, name: 'get_documents', status, durationMs: 120, documentCount: 2}
		});
		const approval = (id: string): ChatStreamEvent => ({
			type: 'approval_required',
			data: {id, approvalId: 'ap-1', name: 'get_attachment_content', arguments: {attachmentId: 7}, expiresAt: '2026-01-01T10:00:00Z'}
		});

		it('ajoute une étape en cours à tool_call puis la termine à tool_result de même id', () => {
			feed(toolCall('t1'));
			expect(message.toolSteps).toEqual([{id: 't1', name: 'get_documents', arguments: {ids: ['d1']}, status: 'running'}]);

			feed(toolCall('t2', 'search_social_insurance_documentation'), toolResult('t1', 'no_result'));
			expect(message.toolSteps.map(step => [step.id, step.status])).toEqual([
				['t1', 'no_result'],
				['t2', 'running']
			]);
			expect(message.toolSteps[0]).toMatchObject({durationMs: 120, documentCount: 2});
		});

		it('suspend l’étape à approval_required et conserve l’approbation après le résultat', () => {
			feed(toolCall('t1', 'get_attachment_content'), approval('t1'));
			expect(message.toolSteps[0]).toMatchObject({
				status: 'awaiting_approval',
				name: 'get_attachment_content',
				arguments: {attachmentId: 7},
				approval: {approvalId: 'ap-1', expiresAt: '2026-01-01T10:00:00Z'}
			});

			feed(toolResult('t1', 'expired'));
			expect(message.toolSteps[0].status).toBe('expired');
			expect(message.toolSteps[0].approval.approvalId).toBe('ap-1');
		});

		it('ne modifie ni la liste ni les étapes de la version précédente', () => {
			feed(toolCall('t1'));
			const before = message;
			const [step] = before.toolSteps;
			feed(toolResult('t1'));
			expect(message.toolSteps).not.toBe(before.toolSteps);
			expect(before.toolSteps[0]).toBe(step);
			expect(step.status).toBe('running');
		});

		it.each<[string, ChatStreamEvent | 'interrupt']>([
			['done', {type: 'done', data: {messageId: 'm-1', interrupted: true}}],
			['error', {type: 'error', data: {code: 'GENERATION_FAILED'}}],
			['interrupt', 'interrupt']
		])('annule les étapes encore ouvertes à la fin de la réponse (%s)', (_, end) => {
			feed(toolCall('t1'), toolResult('t1'), toolCall('t2'), approval('t2'));
			if (end === 'interrupt') {
				message = processor.interrupt(message);
			} else {
				feed(end);
			}
			expect(message.toolSteps.map(step => step.status)).toEqual(['ok', 'cancelled']);
		});
	});
});
