import {MessageSource} from './chat-history';
import {SseEvent} from '../utils/sse-parser';

/**
 * Événements du flux de réponse du backend (T1), envoyés en SSE sous la forme `event: <type>` + `data: <json>`.
 * Ordre : `start`, puis le contenu, puis un seul événement terminal : `done` (émis après l'enregistrement de
 * l'échange) ou `error` (rien n'est enregistré). Le flux peut rester ouvert après `done` (génération du titre).
 */
export type ChatStreamEvent =
	| {type: 'start'; data: {conversationId?: string; messageId: string}}
	| {type: 'status'; data: {code: string; label: string}}
	| {type: 'text_delta'; data: {text: string}}
	| {type: 'source'; data: MessageSource}
	| {type: 'suggestion'; data: {text: string}}
	| {type: 'workspace'; data: {name: string}}
	| {type: 'done'; data: {messageId: string; interrupted: boolean}}
	| {type: 'error'; data: {code: string; message?: string}};

export type ChatStreamEventType = ChatStreamEvent['type'];

const EVENT_TYPES: ReadonlySet<string> = new Set<ChatStreamEventType>(['start', 'status', 'text_delta', 'source', 'suggestion', 'workspace', 'done', 'error']);

/** Convertit un événement SSE en événement typé ; `null` pour un type inconnu (ignoré, compatibilité ascendante). */
export const toChatStreamEvent = ({event, data}: SseEvent): ChatStreamEvent | null =>
	EVENT_TYPES.has(event) ? ({type: event, data: JSON.parse(data)} as ChatStreamEvent) : null;
