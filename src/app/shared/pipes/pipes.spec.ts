import {FormatNavsPipe} from './format-navs.pipe';
import {HighlightTextPipe} from './highlight-text.pipe';

describe('FormatNavsPipe', () => {
	const pipe = new FormatNavsPipe();

	it.each([
		['7561234567897', '756.1234.5678.97'],
		['756.1234.5678.97', '756.1234.5678.97'],
		['756.12345678.97', '756.1234.5678.97'],
		['12345', '12345'],
		[null, ''],
		[undefined, ''],
		['', '']
	])('%s → %s', (value, expected) => {
		expect(pipe.transform(value)).toBe(expected);
	});
});

describe('HighlightTextPipe', () => {
	const pipe = new HighlightTextPipe();

	it('surligne toutes les occurrences sans tenir compte de la casse', () => {
		expect(pipe.transform('Rente AVS et rente AI', 'rente')).toBe(
			'<span><span class="zco-highlight-text">Rente</span> AVS et <span class="zco-highlight-text">rente</span> AI</span>'
		);
	});

	it('renvoie le texte tel quel sans occurrence', () => {
		expect(pipe.transform('Rente AVS', 'AI')).toBe('<span>Rente AVS</span>');
	});

	it('renvoie une chaîne vide sans texte', () => {
		expect(pipe.transform('', 'x')).toBe('');
		expect(pipe.transform(null, 'x')).toBe('');
	});
});
