import {answerTurn, toSse} from './stream-events';

describe('stream-events (utilitaires de test)', () => {
	const texts = (chunks: string) =>
		answerTurn(chunks)
			.filter(event => event.type === 'text_delta')
			.map(event => event.data.text);

	it('découpe par mots en conservant tous les espaces', () => {
		expect(texts('Bonjour  le monde\n')).toEqual(['Bonjour  ', 'le ', 'monde\n']);
		expect(texts('    const a = 65;').join('')).toBe('    const a = 65;');
		expect(texts('   ')).toEqual(['   ']);
	});

	it('encadre le texte par start et done, avec sources et suggestions', () => {
		const events = answerTurn(['a'], {sources: [{link: 'x.pdf'}], suggestions: ['Q'], messageId: 'm'});
		expect(events.map(event => event.type)).toEqual(['start', 'text_delta', 'source', 'suggestion', 'done']);
		expect(events.at(-1)).toEqual({type: 'done', data: {messageId: 'm', interrupted: false}});
	});

	it('sérialise au format SSE', () => {
		expect(toSse([{type: 'text_delta', data: {text: 'a'}}])).toBe('event: text_delta\ndata: {"text":"a"}\n\n');
	});
});
