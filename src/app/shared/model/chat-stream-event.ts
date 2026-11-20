import {MessageSource} from './chat-history';
import {SseEvent} from '../utils/sse-parser';
import {ToolResultStatus} from './tool-step';

/**
 * Événements du flux de réponse du backend (T1), envoyés en SSE sous la forme `event: <type>` + `data: <json>`.
 * Ordre : `start`, puis le contenu (dont les appels d'outils), puis un seul événement terminal : `done` (émis après
 * l'enregistrement de l'échange) ou `error` (rien n'est enregistré). Le flux peut rester ouvert après `done`
 * (génération du titre).
 */
export type ChatStreamEvent =
	| {type: 'start'; data: {conversationId?: string; messageId: string}}
	| {type: 'status'; data: {code: string; label: string}}
	| {type: 'text_delta'; data: {text: string}}
	| {type: 'source'; data: MessageSource}
	| {type: 'suggestion'; data: {text: string}}
	| {type: 'workspace'; data: {name: string}}
	/** Appel d'outil annoncé avant son exécution ; toujours suivi d'un `tool_result` de même `id` (sauf interruption). */
	| {type: 'tool_call'; data: {id: string; name: string; arguments: Record<string, unknown>}}
	| {type: 'tool_result'; data: {id: string; name: string; status: ToolResultStatus; durationMs: number; documentCount: number}}
	/** Outil suspendu jusqu'à la décision de l'utilisateur, au plus tard jusqu'à `expiresAt` (ISO-8601 UTC). */
	| {type: 'approval_required'; data: {id: string; approvalId: string; name: string; arguments: Record<string, unknown>; expiresAt: string}}
	| {type: 'done'; data: {messageId: string; interrupted: boolean}}
	| {type: 'error'; data: {code: string; message?: string}};

export type ChatStreamEventType = ChatStreamEvent['type'];

const EVENT_TYPES: ReadonlySet<string> = new Set<ChatStreamEventType>([
	'start',
	'status',
	'text_delta',
	'source',
	'suggestion',
	'workspace',
	'tool_call',
	'tool_result',
	'approval_required',
	'done',
	'error'
]);

/** Convertit un événement SSE en événement typé ; `null` pour un type inconnu (ignoré, compatibilité ascendante). */
export const toChatStreamEvent = ({event, data}: SseEvent): ChatStreamEvent | null =>
	EVENT_TYPES.has(event) ? ({type: event, data: JSON.parse(data)} as ChatStreamEvent) : null;
