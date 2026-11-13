import {ChatStreamProcessorService} from './chat-stream-processor.service';
import {ChatMessage} from '../../shared/model/chat-message';

describe('ChatStreamProcessorService', () => {
	let processor: ChatStreamProcessorService;
	let message: ChatMessage;

	const feed = (...chunks: string[]) => chunks.map(chunk => processor.processChunk(chunk, message));

	beforeEach(() => {
		processor = new ChatStreamProcessorService();
		message = {message: ''} as ChatMessage;
	});

	it('détecte les balises de statut dans des chunks consécutifs (pas d’état lastIndex partagé)', () => {
		feed('<retrieval>Recherche…</retrieval>');
		expect(message.isRetrieving).toBe(true);
		expect(message.message).toBe('Recherche…');

		feed('<retrieval>Encore</retrieval>');
		expect(message.message).toBe('Encore');
	});

	it('remplace le statut par le contenu dès le premier token', () => {
		feed('<routing>Routage</routing>', 'Bonjour', ' monde');
		expect(message.isRouting).toBe(false);
		expect(message.message).toBe('Bonjour monde');
	});

	it('extrait une source découpée sur plusieurs chunks', () => {
		feed('Réponse ', '<source><id>1</id><url>http://a</url><file></file>', '<pn>2</pn><sub>s</sub><v>v1</v></source>', ' fin');
		expect(message.message).toBe('Réponse  fin');
		expect(message.sources).toEqual([{documentId: '1', type: 'URL', link: 'http://a', pageNumber: '2', subsection: 's', version: 'v1'}]);
	});

	it('extrait plusieurs sources arrivées dans le même chunk', () => {
		feed(
			'Texte',
			'<source><id>1</id><url></url><file>a.pdf</file><pn>1</pn><sub></sub><v></v></source>' +
				'<source><id>2</id><url></url><file>b.pdf</file><pn>3</pn><sub></sub><v></v></source>'
		);
		expect(message.message).toBe('Texte');
		expect(message.sources.map(s => s.link)).toEqual(['a.pdf', 'b.pdf']);
	});

	it('extrait le workspace, les suggestions et l’identifiant de message', () => {
		feed('Réponse');
		const [workspace] = feed('<workspace><name>AVS</name></workspace>');
		const [suggestions] = feed('<suggestion>Q1</suggestion><suggestion>Q2</suggestion>');
		const [end] = feed('<message_uuid>abc-123</message_uuid>');

		expect(message.workspace).toBe('AVS');
		expect(workspace.newSuggestions).toEqual([]);
		expect(suggestions.newSuggestions).toEqual(['Q1', 'Q2']);
		expect(end.shouldEnableSearch).toBe(true);
		expect(message.id).toBe('abc-123');
		expect(message.isCompleted).toBe(true);
		expect(message.message).toBe('Réponse');
	});

	it('ne termine pas la réponse tant que la balise message_uuid est incomplète', () => {
		const partial = feed('Réponse', '<message_uuid>abc').at(-1);
		expect(partial.shouldEnableSearch).toBe(false);
		const [end] = feed('</message_uuid>');
		expect(end.shouldEnableSearch).toBe(true);
		expect(message.id).toBe('abc');
	});
	it('interrupt conserve la réponse partielle et la marque interrompue', () => {
		feed('Début de réponse');
		processor.interrupt(message);
		expect(message.message).toBe('Début de réponse');
		expect(message.isCompleted).toBe(true);
		expect(message.interrupted).toBe(true);
	});

	it('interrupt efface le texte de statut si la réponse n’a pas commencé', () => {
		feed('<retrieval>Recherche…</retrieval>');
		processor.interrupt(message);
		expect(message.message).toBe('');
		expect(message.isRetrieving).toBe(false);
		expect(message.interrupted).toBe(true);
	});
});
