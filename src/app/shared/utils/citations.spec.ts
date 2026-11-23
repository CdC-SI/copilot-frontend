import {aSource} from '../../../testing/stream-events';
import {
	citationsToText,
	citedSource,
	sortSourcesByCitation,
	sourceLabel,
	splitCitations,
	stripCitations,
	transformOutsideCode,
	upsertSource
} from './citations';

describe('citations', () => {
	const upper = (markdown: string) => transformOutsideCode(markdown, text => text.toUpperCase());

	describe('transformOutsideCode', () => {
		it('transforme le texte mais pas le code en ligne', () => {
			expect(upper('a `b` c ``d ` e`` f')).toBe('A `b` C ``d ` e`` F');
		});

		it('laisse un backtick sans fermeture dans le texte', () => {
			expect(upper('a ` b')).toBe('A ` B');
		});

		it('conserve les blocs délimités jusqu’à une ligne de fermeture compatible', () => {
			const markdown = 'avant\n````js\nx\n```\nencore\n````\naprès\n~~~\ny\n~~~\nfin';
			expect(upper(markdown)).toBe('AVANT\n````js\nx\n```\nencore\n````\nAPRÈS\n~~~\ny\n~~~\nFIN');
		});

		it('le code en ligne peut couvrir plusieurs lignes d’un paragraphe, mais pas une ligne vide', () => {
			expect(stripCitations('Avant `code\n[^1]` après [^2].')).toBe('Avant `code\n[^1]` après.');
			expect(upper('a `b\n\nc` d')).toBe('A `B\n\nC` D');
		});

		it('une ligne de fermeture suivie de texte ne ferme pas le bloc', () => {
			expect(upper('```\n``` pas fini\nx\n```\nz')).toBe('```\n``` pas fini\nx\n```\nZ');
		});
	});

	it('stripCitations retire les marqueurs et leurs espaces, hors code', () => {
		expect(stripCitations('Le délai est de 30 jours [^1][^2]. Voir `[^3]`.')).toBe('Le délai est de 30 jours. Voir `[^3]`.');
		expect(stripCitations('')).toBe('');
	});

	it('sourceLabel donne un libellé court selon le type', () => {
		expect(sourceLabel(aSource({type: 'FILE', link: 'docs/dir/guide.pdf'}))).toBe('guide.pdf');
		expect(sourceLabel(aSource({type: 'URL', link: 'https://www.ahv-iv.ch/fr/memento'}))).toBe('ahv-iv.ch/fr/memento');
		expect(sourceLabel(aSource({type: 'URL', link: 'pas une url'}))).toBe('pas une url');
		expect(sourceLabel(aSource({type: 'BUSINESS_PROCESS', link: 'https://bpanda/1', title: 'Rente'}))).toBe('Rente');
		expect(sourceLabel(aSource({type: 'BUSINESS_PROCESS', link: 'https://bpanda/1', title: undefined}))).toBe('https://bpanda/1');
	});

	it('sortSourcesByCitation place les sources citées d’abord, par numéro', () => {
		const sources = [aSource({documentId: 'a'}), aSource({documentId: 'b', citation: 2}), aSource({documentId: 'c', citation: 1})];
		expect(sortSourcesByCitation(sources).map(source => source.documentId)).toEqual(['c', 'b', 'a']);
	});

	it('upsertSource remplace une source citée par numéro et ajoute les autres', () => {
		const cited = aSource({documentId: 'a', citation: 1});
		let sources = upsertSource([], cited);
		sources = upsertSource(sources, aSource({documentId: 'b'}));
		sources = upsertSource(sources, aSource({documentId: 'a', pageNumber: '9', citation: 1}));
		expect(sources.map(source => [source.documentId, source.pageNumber, source.citation])).toEqual([
			['a', '9', 1],
			['b', aSource().pageNumber, undefined]
		]);
		expect(citedSource(sources, 1)?.pageNumber).toBe('9');
		expect(citedSource(sources, 2)).toBeUndefined();
		expect(citedSource(undefined, 1)).toBeUndefined();
	});

	describe('citationsToText', () => {
		it('convertit les marqueurs et ajoute la liste des sources citées', () => {
			const sources = [
				aSource({type: 'URL', link: 'https://example.ch/x', pageNumber: undefined, citation: 2}),
				aSource({type: 'FILE', link: 'a/guide.pdf', pageNumber: '3', citation: 1}),
				aSource({type: 'FILE', link: 'autre.pdf'})
			];
			expect(citationsToText('Texte [^1] et [^2], `[^1]`.\n', sources, 'Sources :', 'p.')).toBe(
				'Texte [1] et [2], `[^1]`.\n\nSources :\n[1] guide.pdf, p. 3\n[2] example.ch/x (https://example.ch/x)'
			);
		});

		it('sans source citée, ne convertit que les marqueurs', () => {
			expect(citationsToText('Texte [^1]', undefined, 'Sources :', 'p.')).toBe('Texte [1]');
			expect(citationsToText('', [], 'Sources :', 'p.')).toBe('');
		});
	});

	it('splitCitations découpe texte et numéros', () => {
		expect(splitCitations('a [^1][^12] b')).toEqual(['a ', 1, 12, ' b']);
		expect(splitCitations('[^3]')).toEqual([3]);
		expect(splitCitations('sans')).toEqual(['sans']);
	});
});
