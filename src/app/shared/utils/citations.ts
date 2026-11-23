import {MessageSource} from '../model/chat-history';

/** Marqueur canonique de citation émis par le backend (F2a) : `[^n]`, numéro affiché de la source. */
const MARKER = /\[\^(\d{1,3})]/g;
/** Marqueur précédé de ses espaces (retrait sans laisser d'espace avant la ponctuation). */
const MARKER_WITH_SPACES = /[ \t]*\[\^\d{1,3}]/g;
const FENCE = /^ {0,3}(`{3,}|~{3,})/;

/**
 * Applique `transform` au texte Markdown hors code : les blocs délimités (au moins trois `` ` `` ou `~` en tête de
 * ligne, fermés par une ligne du même caractère au moins aussi longue) et le code en ligne sont conservés tels quels,
 * comme le fait le backend.
 */
export function transformOutsideCode(markdown: string, transform: (text: string) => string): string {
	let fence: {char: string; length: number} | null = null;
	let out = '';
	// Paragraphe courant (lignes hors bloc délimité) : un code en ligne peut s'étendre sur plusieurs lignes.
	let paragraph = '';
	const flush = (): void => {
		out += transformOutsideInlineCode(paragraph, transform);
		paragraph = '';
	};
	for (const line of markdown.split(/(?<=\n)/)) {
		const opening = FENCE.exec(line)?.[1];
		if (fence) {
			if (opening?.startsWith(fence.char) && opening.length >= fence.length && !line.slice(line.indexOf(opening) + opening.length).trim()) {
				fence = null;
			}
			out += line;
			continue;
		}
		if (opening) {
			flush();
			fence = {char: opening[0], length: opening.length};
			out += line;
			continue;
		}
		paragraph += line;
		if (!line.trim()) flush();
	}
	flush();
	return out;
}

function transformOutsideInlineCode(text: string, transform: (text: string) => string): string {
	let out = '';
	let plainStart = 0;
	let i = 0;
	while (i < text.length) {
		if (text[i] !== '`') {
			i++;
			continue;
		}
		const run = runEnd(text, i);
		const close = closingRun(text, run, run - i);
		if (close < 0) {
			i = run;
			continue;
		}
		out += transform(text.slice(plainStart, i)) + text.slice(i, close);
		i = close;
		plainStart = close;
	}
	return out + transform(text.slice(plainStart));
}

function runEnd(line: string, start: number): number {
	let i = start;
	while (line[i] === '`') i++;
	return i;
}

/** Fin de la première suite d'exactement `length` backticks à partir de `from`, ou -1. */
function closingRun(line: string, from: number, length: number): number {
	let i = from;
	while (i < line.length) {
		if (line[i] !== '`') {
			i++;
			continue;
		}
		const run = runEnd(line, i);
		if (run - i === length) return run;
		i = run;
	}
	return -1;
}

/** Texte sans marqueurs de citation (lecture vocale, FAQ…). */
export function stripCitations(markdown: string): string {
	return markdown ? transformOutsideCode(markdown, text => text.replace(MARKER_WITH_SPACES, '')) : markdown;
}

/** Libellé court d'une source : nom du fichier, adresse sans protocole, ou titre du processus métier. */
export function sourceLabel(source: MessageSource): string {
	if (source.type === 'BUSINESS_PROCESS') {
		return source.title || source.link || '';
	}
	if (source.type === 'URL') {
		try {
			const {hostname, pathname} = new URL(source.link);
			return hostname.replace(/^www\./, '') + pathname;
		} catch {
			return source.link;
		}
	}
	return source.link?.split('/').pop() ?? source.link ?? '';
}

/** Sources citées d'abord, par numéro, puis les autres dans leur ordre d'origine. */
export function sortSourcesByCitation(sources: MessageSource[]): MessageSource[] {
	const cited = sources.filter(source => source.citation != null).sort((a, b) => a.citation - b.citation);
	return [...cited, ...sources.filter(source => source.citation == null)];
}

/**
 * Ajoute ou met à jour une source : une source citée remplace celle qui porte le même numéro (l'événement `citation`
 * puis la liste de fin de réponse décrivent la même source) ; une source non citée est ajoutée.
 */
export function upsertSource(sources: MessageSource[], source: MessageSource): MessageSource[] {
	if (source.citation == null) {
		return [...sources, source];
	}
	const index = sources.findIndex(existing => existing.citation === source.citation);
	return index === -1 ? [...sources, source] : sources.map((existing, i) => (i === index ? source : existing));
}

/** Source citée sous le numéro `n`. */
export function citedSource(sources: MessageSource[] | undefined, n: number): MessageSource | undefined {
	return sources?.find(source => source.citation === n);
}

/**
 * Version texte d'une réponse (copie) : `[^n]` → `[n]`, suivie de la liste des sources citées
 * (`[n] libellé, p. 3`) sous le titre `sourcesTitle`.
 */
export function citationsToText(markdown: string, sources: MessageSource[] | undefined, sourcesTitle: string, pageLabel: string): string {
	if (!markdown) return markdown;
	const text = transformOutsideCode(markdown, plain => plain.replace(MARKER, '[$1]'));
	const cited = sortSourcesByCitation(sources ?? []).filter(source => source.citation != null);
	if (!cited.length) return text;
	const lines = cited.map(source => {
		const page = source.pageNumber ? `, ${pageLabel} ${source.pageNumber}` : '';
		const link = source.type === 'URL' ? ` (${source.link})` : '';
		return `[${source.citation}] ${sourceLabel(source)}${page}${link}`;
	});
	return `${text.trimEnd()}\n\n${sourcesTitle}\n${lines.join('\n')}`;
}

/** Découpe un texte brut en segments de texte et numéros de citation (rendu des pastilles). */
export function splitCitations(text: string): (string | number)[] {
	const parts: (string | number)[] = [];
	let last = 0;
	for (const match of text.matchAll(MARKER)) {
		if (match.index > last) parts.push(text.slice(last, match.index));
		parts.push(Number(match[1]));
		last = match.index + match[0].length;
	}
	if (last < text.length) parts.push(text.slice(last));
	return parts;
}
