import {ChatStreamProcessorService} from './chat-stream-processor.service';
import {ChatMessage} from '../../shared/model/chat-message';
import {ChatStreamEvent} from '../../shared/model/chat-stream-event';

describe('ChatStreamProcessorService', () => {
	let processor: ChatStreamProcessorService;
	let message: ChatMessage;

	const feed = (...events: ChatStreamEvent[]) => events.map(event => processor.processEvent(event, message));
	const text = (value: string): ChatStreamEvent => ({type: 'text_delta', data: {text: value}});
	const status = (code: string, label: string): ChatStreamEvent => ({type: 'status', data: {code, label}});

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
		processor.interrupt(message);
		expect(message.message).toBe('Début de réponse');
		expect(message.isCompleted).toBe(true);
		expect(message.interrupted).toBe(true);
	});

	it('interrupt efface le texte de statut si la réponse n’a pas commencé', () => {
		feed(status('retrieval', 'Recherche…'));
		processor.interrupt(message);
		expect(message.message).toBe('');
		expect(message.status).toBeUndefined();
		expect(message.interrupted).toBe(true);
	});
});
