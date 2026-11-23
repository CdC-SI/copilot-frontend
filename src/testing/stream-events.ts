import type {ChatStreamEvent} from '../app/shared/model/chat-stream-event';
import type {MessageSource} from '../app/shared/model/chat-history';
import type {ToolResultStatus} from '../app/shared/model/tool-step';

/**
 * Fabriques d'événements du flux de réponse (`ChatStreamEvent`), partagées par les tests unitaires (Jest) et les
 * parcours e2e (Playwright). Aucune dépendance Angular : ce fichier doit rester importable depuis `e2e/`.
 */
export const streamEvents = {
	start: (messageId = 'g1', conversationId?: string): ChatStreamEvent => ({type: 'start', data: {conversationId, messageId}}),
	status: (code: string, label = code): ChatStreamEvent => ({type: 'status', data: {code, label}}),
	text: (text: string): ChatStreamEvent => ({type: 'text_delta', data: {text}}),
	source: (source: Partial<MessageSource> = {}): ChatStreamEvent => ({type: 'source', data: aSource(source)}),
	/** Première citation `[^n]` d'une source (à émettre avant le texte qui porte le marqueur). */
	citation: (n: number, source: Partial<MessageSource> = {}): ChatStreamEvent => ({type: 'citation', data: {n, source: aSource({...source, citation: n})}}),
	suggestion: (text: string): ChatStreamEvent => ({type: 'suggestion', data: {text}}),
	workspace: (name: string): ChatStreamEvent => ({type: 'workspace', data: {name}}),
	toolCall: (id: string, name: string, args: Record<string, unknown> = {}): ChatStreamEvent => ({type: 'tool_call', data: {id, name, arguments: args}}),
	toolResult: (id: string, name: string, status: ToolResultStatus = 'ok', documentCount = 0): ChatStreamEvent => ({
		type: 'tool_result',
		data: {id, name, status, durationMs: 10, documentCount}
	}),
	done: (messageId = 'a1', interrupted = false): ChatStreamEvent => ({type: 'done', data: {messageId, interrupted}}),
	error: (code: string, message?: string): ChatStreamEvent => ({type: 'error', data: {code, message}})
};

/** Source de réponse avec des valeurs par défaut plausibles (document du corpus). */
export function aSource(source: Partial<MessageSource> = {}): MessageSource {
	return {type: 'FILE', link: 'directive-avs.pdf', documentId: 'doc-1', pageNumber: '1', ...source};
}

/** Options d'un tour de réponse complet. */
export interface AnswerTurnOptions {
	generationId?: string;
	messageId?: string;
	conversationId?: string;
	sources?: Partial<MessageSource>[];
	suggestions?: string[];
}

/**
 * Tour de réponse complet : `start`, le texte en morceaux, les sources et suggestions éventuelles, puis `done`.
 * `chunks` : texte déjà découpé, ou texte unique découpé par mots (simule le streaming).
 */
export function answerTurn(chunks: string | string[], options: AnswerTurnOptions = {}): ChatStreamEvent[] {
	// Découpage par mots, espaces conservés (y compris en tête) : la concaténation des morceaux redonne le texte.
	const parts = Array.isArray(chunks) ? chunks : (chunks.match(/^\s+|\S+\s*/g) ?? []);
	return [
		streamEvents.start(options.generationId ?? 'g1', options.conversationId),
		...parts.map(part => streamEvents.text(part)),
		...(options.sources ?? []).map(source => streamEvents.source(source)),
		...(options.suggestions ?? []).map(text => streamEvents.suggestion(text)),
		streamEvents.done(options.messageId ?? 'a1')
	];
}

/** Sérialise des événements au format SSE (`event:` + `data:` JSON), tel qu'émis par le backend. */
export function toSse(events: ChatStreamEvent[]): string {
	return events.map(({type, data}) => `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`).join('');
}
