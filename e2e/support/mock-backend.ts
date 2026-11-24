import {Page, Request, Route, test as base} from '@playwright/test';
import type {ChatStreamEvent} from '../../src/app/shared/model/chat-stream-event';
import type {AttachmentUploadResponse, ChatTitle, Conversation} from '../../src/app/shared/model/chat-history';
import type {IUser} from '../../src/app/shared/model/user';
import type {SourceView} from '../../src/app/shared/model/source-view';
import type {ToolApprovalDecision} from '../../src/app/shared/model/tool-step';
import {aUser} from '../../src/testing/fixtures';
import {toSse} from '../../src/testing/stream-events';

const API = '**/zia/api/';

/** Question reçue par `POST /conversations` (FormData multipart). */
export interface ChatRequestRecord {
	query: string;
	conversationId?: string;
	replaceMessageId?: string;
}

/** Réponse HTTP en erreur à une question (`replyHttpError`), au lieu du flux SSE. */
interface HttpErrorReply {
	status: number;
	code?: string;
}

/** Fichier renvoyé par le backend simulé. */
export interface MockFile {
	body: Buffer;
	contentType: string;
}

/** Réponse à un envoi de pièces jointes : `json` (statut 200 par défaut), livrée après `release` s'il est fourni. */
export interface AttachmentUploadReply {
	status?: number;
	json: AttachmentUploadResponse | {MESSAGE: string};
	release?: Promise<unknown>;
}

/** Envoi de pièces jointes reçu (`POST /conversations/attachments`). */
export interface AttachmentUploadRecord {
	conversationId?: string;
	files: string[];
}

/** Promesse résolue par le test : retient une réponse du backend simulé (état intermédiaire observable). */
export function gate(): {promise: Promise<void>; open: () => void} {
	let open!: () => void;
	const promise = new Promise<void>(resolve => (open = resolve));
	return {promise, open};
}

/**
 * Backend simulé pour les parcours e2e : toutes les requêtes `/zia/api/**` sont interceptées.
 * Une requête non prévue reçoit une réponse vide (`[]` en GET, 204 sinon) et est notée dans `unexpected`.
 */
export class MockBackend {
	user: IUser = aUser();
	titles: ChatTitle[] = [];
	readonly conversations = new Map<string, Conversation>();
	/** Vues des sources (`GET /source-documents/{id}`), par identifiant ; absente : 404. */
	readonly sourceViews = new Map<string, SourceView>();
	/** Fichiers des sources (`GET /source-documents/{id}/file`), par identifiant ; absent : 404. */
	readonly sourceFiles = new Map<string, MockFile>();
	/** Documents téléchargés par nom (`GET /documents?filename=`, source sans identifiant) ; absent : 404. */
	readonly documents = new Map<string, MockFile>();
	/** Réponses des prochaines questions (flux SSE ou erreur HTTP), consommées dans l'ordre. */
	readonly replies: (ChatStreamEvent[] | HttpErrorReply)[] = [];
	readonly chatRequests: ChatRequestRecord[] = [];
	/** Demandes d'arrêt reçues (`POST /conversations/{id}/generations/{messageId}/stop`, réponse 202). */
	readonly stopRequests: {conversationId: string; generationId: string}[] = [];
	/** Décisions d'approbation d'outil reçues (`POST /conversations/{id}/approvals/{approvalId}`). */
	readonly approvalDecisions: {conversationId: string; approvalId: string; decision: ToolApprovalDecision}[] = [];
	/** Statut HTTP de la réponse aux décisions d'approbation : 204, ou 404 (demande expirée ou déjà tranchée). */
	approvalStatus = 204;
	/** Réponses aux prochains envois de pièces jointes, consommées dans l'ordre. */
	readonly attachmentReplies: AttachmentUploadReply[] = [];
	readonly attachmentUploads: AttachmentUploadRecord[] = [];
	/**
	 * Réponses au suivi du traitement (`GET /conversations/{id}/attachments`), consommées dans l'ordre ; la dernière
	 * est répétée. Le suivi interroge immédiatement après un envoi resté `PENDING`, puis toutes les 15 s.
	 */
	readonly attachmentStatuses: AttachmentUploadResponse[] = [];
	readonly unexpected: string[] = [];

	constructor(private readonly page: Page) {}

	/** Ajoute la réponse SSE à la prochaine question. */
	reply(...events: ChatStreamEvent[]): this {
		this.replies.push(events);
		return this;
	}

	/** La prochaine question reçoit une réponse HTTP en erreur (`code` : champ `MESSAGE` du corps, ex. `TURN_NOT_REPLACEABLE`). */
	replyHttpError(status: number, code?: string): this {
		this.replies.push({status, code});
		return this;
	}

	/**
	 * Réponse SSE pilotée par le test, envoyée en plusieurs étapes (vérifier l'affichage avant la fin du flux).
	 * À appeler avant la navigation : `fetch` est remplacé dans la page pour `POST /conversations` (une réponse
	 * `page.route` est toujours livrée en une fois) ; les questions sont alors notées par `ManualStream.requests()`
	 * (et non dans `chatRequests`). Chaque question ouvre un nouveau flux.
	 */
	async manualStream(): Promise<ManualStream> {
		await this.page.addInitScript(() => {
			const w = window as unknown as {__e2eStreams: ReadableStreamDefaultController<Uint8Array>[]; __e2eRequests: Record<string, string>[]};
			w.__e2eStreams = [];
			w.__e2eRequests = [];
			const originalFetch = window.fetch.bind(window);
			window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
				// Pas de référence à Request : le nom est lié à l'import Playwright lors de la transpilation.
				const url = new URL(typeof input === 'object' && 'url' in input ? input.url : String(input), location.href);
				if (init?.method !== 'POST' || !url.pathname.endsWith('/zia/api/conversations')) {
					return originalFetch(input, init);
				}
				const fields: Record<string, string> = {};
				if (init.body instanceof FormData) init.body.forEach((value, key) => typeof value === 'string' && (fields[key] = value));
				w.__e2eRequests.push(fields);
				const body = new ReadableStream<Uint8Array>({start: controller => void w.__e2eStreams.push(controller)});
				return Promise.resolve(new Response(body, {status: 200, headers: {'Content-Type': 'text/event-stream'}}));
			};
		});
		return new ManualStream(this.page);
	}

	async install(): Promise<void> {
		// Playwright : la dernière route déclarée est prioritaire ; le filet générique est donc déclaré en premier.
		await this.page.route(`${API}**`, route => this.fallback(route));
		await this.page.route(`${API}users/authenticated`, route => route.fulfill({json: this.user}));
		await this.page.route(`${API}conversations/titles`, route => route.fulfill({json: this.titles}));
		await this.page.route(/\/zia\/api\/conversations\/(?!titles|attachments|feedbacks)[^/?]+$/, route => this.conversation(route));
		await this.page.route(`${API}conversations`, route => this.chat(route));
		await this.page.route(/\/zia\/api\/conversations\/[^/?]+\/generations\/[^/?]+\/stop$/, route => this.stop(route));
		await this.page.route(/\/zia\/api\/conversations\/[^/?]+\/approvals\/[^/?]+$/, route => this.approval(route));
		await this.page.route(/\/zia\/api\/conversations\/attachments(\?.*)?$/, route => this.uploadAttachments(route));
		await this.page.route(/\/zia\/api\/conversations\/[^/?]+\/attachments$/, route => this.attachmentsStatus(route));
		await this.page.route(/\/zia\/api\/source-documents\/[^/?]+(\/file)?$/, route => this.sourceDocument(route));
		await this.page.route(/\/zia\/api\/documents\?/, route => this.document(route));
	}

	private async conversation(route: Route): Promise<void> {
		const id = new URL(route.request().url()).pathname.split('/').pop();
		if (route.request().method() !== 'GET') {
			return route.fulfill({status: 204});
		}
		const conversation = this.conversations.get(id);
		return conversation ? route.fulfill({json: conversation}) : route.fulfill({status: 404, json: {MESSAGE: 'NOT_FOUND'}});
	}

	private async sourceDocument(route: Route): Promise<void> {
		const segments = new URL(route.request().url()).pathname.split('/');
		const file = segments.at(-1) === 'file';
		const id = decodeURIComponent(segments.at(file ? -2 : -1) ?? '');
		if (file) {
			const content = this.sourceFiles.get(id);
			return content ? route.fulfill({body: content.body, contentType: content.contentType}) : route.fulfill({status: 404});
		}
		const view = this.sourceViews.get(id);
		return view ? route.fulfill({json: view}) : route.fulfill({status: 404, json: {MESSAGE: 'NOT_FOUND'}});
	}

	private async chat(route: Route): Promise<void> {
		if (route.request().method() !== 'POST') {
			return this.fallback(route);
		}
		this.chatRequests.push(parseChatRequest(route.request()));
		const reply = this.replies.shift();
		if (!reply) {
			this.unexpected.push('POST /conversations (aucune réponse prévue)');
			return route.fulfill({status: 500, json: {MESSAGE: 'NO_SCRIPTED_REPLY'}});
		}
		if (!Array.isArray(reply)) {
			return route.fulfill({status: reply.status, json: {MESSAGE: reply.code ?? 'ERROR'}});
		}
		return route.fulfill({status: 200, headers: {'Content-Type': 'text/event-stream'}, body: toSse(reply)});
	}

	private async stop(route: Route): Promise<void> {
		const [, conversationId, generationId] = /\/conversations\/([^/]+)\/generations\/([^/]+)/.exec(route.request().url()) ?? [];
		this.stopRequests.push({conversationId, generationId});
		return route.fulfill({status: 202});
	}

	private async approval(route: Route): Promise<void> {
		const [, conversationId, approvalId] = /\/conversations\/([^/]+)\/approvals\/([^/?]+)/.exec(route.request().url()) ?? [];
		const {decision} = route.request().postDataJSON() as {decision: ToolApprovalDecision};
		this.approvalDecisions.push({conversationId, approvalId, decision});
		return this.approvalStatus < 300
			? route.fulfill({status: this.approvalStatus})
			: route.fulfill({status: this.approvalStatus, json: {MESSAGE: 'NOT_FOUND'}});
	}

	private async uploadAttachments(route: Route): Promise<void> {
		const request = route.request();
		const body = request.postDataBuffer()?.toString('latin1') ?? '';
		const files = [...body.matchAll(/filename="([^"]*)"/g)].map(match => match[1]);
		this.attachmentUploads.push({conversationId: new URL(request.url()).searchParams.get('conversationId') ?? undefined, files});
		const reply = this.attachmentReplies.shift();
		if (!reply) {
			this.unexpected.push('POST /conversations/attachments (aucune réponse prévue)');
			return route.fulfill({status: 500, json: {MESSAGE: 'UPLOAD_FAILED'}});
		}
		await reply.release;
		return route.fulfill({status: reply.status ?? 200, json: reply.json});
	}

	private async attachmentsStatus(route: Route): Promise<void> {
		const status = this.attachmentStatuses.length > 1 ? this.attachmentStatuses.shift() : this.attachmentStatuses[0];
		return status ? route.fulfill({json: status}) : this.fallback(route);
	}

	private async document(route: Route): Promise<void> {
		const filename = new URL(route.request().url()).searchParams.get('filename') ?? '';
		const content = this.documents.get(filename);
		return content ? route.fulfill({body: content.body, contentType: content.contentType}) : route.fulfill({status: 404});
	}

	private async fallback(route: Route): Promise<void> {
		const request = route.request();
		this.unexpected.push(`${request.method()} ${new URL(request.url()).pathname}`);
		return request.method() === 'GET' ? route.fulfill({json: []}) : route.fulfill({status: 204});
	}
}

/** Flux SSE ouverts par la page (`MockBackend.manualStream`), alimentés étape par étape. */
export class ManualStream {
	constructor(private readonly page: Page) {}

	/** Attend que la page ait ouvert `count` flux (une question, une régénération ou une modification chacune). */
	async opened(count: number): Promise<void> {
		await this.page.waitForFunction(n => (window as unknown as {__e2eStreams: unknown[]}).__e2eStreams.length >= n, count);
	}

	/** Envoie des événements sur le dernier flux ouvert (attend qu'une question ait été posée). */
	async send(...events: ChatStreamEvent[]): Promise<void> {
		await this.opened(1);
		await this.page.evaluate(sse => {
			const streams = (window as unknown as {__e2eStreams: ReadableStreamDefaultController<Uint8Array>[]}).__e2eStreams;
			streams[streams.length - 1].enqueue(new TextEncoder().encode(sse));
		}, toSse(events));
	}

	async close(): Promise<void> {
		await this.page.evaluate(() => {
			const streams = (window as unknown as {__e2eStreams: ReadableStreamDefaultController<Uint8Array>[]}).__e2eStreams;
			streams[streams.length - 1].close();
		});
	}

	/** Questions envoyées sur les flux pilotés (champs texte du FormData), dans l'ordre. */
	async requests(): Promise<ChatRequestRecord[]> {
		const requests = await this.page.evaluate(() => (window as unknown as {__e2eRequests: Record<string, string>[]}).__e2eRequests);
		return requests.map(({query, conversationId, replaceMessageId}) => ({query: query ?? '', conversationId, replaceMessageId}));
	}
}

/** Champs texte d'un corps multipart (suffisant pour les champs simples de la question). */
function parseChatRequest(request: Request): ChatRequestRecord {
	const body = request.postData() ?? '';
	const field = (name: string): string | undefined => new RegExp(`name="${name}"\\r\\n\\r\\n([\\s\\S]*?)\\r\\n--`).exec(body)?.[1];
	return {query: field('query') ?? '', conversationId: field('conversationId'), replaceMessageId: field('replaceMessageId')};
}

/** Fixture Playwright : `backend` est installé avant le test ; aller sur une page après l'avoir configuré. */
export const test = base.extend<{backend: MockBackend}>({
	backend: async ({page}, use) => {
		const backend = new MockBackend(page);
		await backend.install();
		await use(backend);
	}
});

export {expect} from '@playwright/test';
