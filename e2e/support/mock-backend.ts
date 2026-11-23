import {Page, Request, Route, test as base} from '@playwright/test';
import type {ChatStreamEvent} from '../../src/app/shared/model/chat-stream-event';
import type {ChatTitle, Conversation} from '../../src/app/shared/model/chat-history';
import type {IUser} from '../../src/app/shared/model/user';
import {aUser} from '../../src/testing/fixtures';
import {toSse} from '../../src/testing/stream-events';

const API = '**/zia/api/';

/** Question reçue par `POST /conversations` (FormData multipart). */
export interface ChatRequestRecord {
	query: string;
	conversationId?: string;
	replaceMessageId?: string;
}

/**
 * Backend simulé pour les parcours e2e : toutes les requêtes `/zia/api/**` sont interceptées.
 * Une requête non prévue reçoit une réponse vide (`[]` en GET, 204 sinon) et est notée dans `unexpected`.
 */
export class MockBackend {
	user: IUser = aUser();
	titles: ChatTitle[] = [];
	readonly conversations = new Map<string, Conversation>();
	/** Réponses SSE des prochaines questions, consommées dans l'ordre. */
	readonly replies: ChatStreamEvent[][] = [];
	readonly chatRequests: ChatRequestRecord[] = [];
	readonly unexpected: string[] = [];

	constructor(private readonly page: Page) {}

	/** Ajoute la réponse SSE à la prochaine question. */
	reply(...events: ChatStreamEvent[]): this {
		this.replies.push(events);
		return this;
	}

	async install(): Promise<void> {
		// Playwright : la dernière route déclarée est prioritaire ; le filet générique est donc déclaré en premier.
		await this.page.route(`${API}**`, route => this.fallback(route));
		await this.page.route(`${API}users/authenticated`, route => route.fulfill({json: this.user}));
		await this.page.route(`${API}conversations/titles`, route => route.fulfill({json: this.titles}));
		await this.page.route(/\/zia\/api\/conversations\/(?!titles|attachments|feedbacks)[^/?]+$/, route => this.conversation(route));
		await this.page.route(`${API}conversations`, route => this.chat(route));
	}

	private async conversation(route: Route): Promise<void> {
		const id = new URL(route.request().url()).pathname.split('/').pop();
		if (route.request().method() !== 'GET') {
			return route.fulfill({status: 204});
		}
		const conversation = this.conversations.get(id);
		return conversation ? route.fulfill({json: conversation}) : route.fulfill({status: 404, json: {MESSAGE: 'NOT_FOUND'}});
	}

	private async chat(route: Route): Promise<void> {
		if (route.request().method() !== 'POST') {
			return this.fallback(route);
		}
		this.chatRequests.push(parseChatRequest(route.request()));
		const events = this.replies.shift();
		if (!events) {
			this.unexpected.push('POST /conversations (aucune réponse prévue)');
			return route.fulfill({status: 500, json: {MESSAGE: 'NO_SCRIPTED_REPLY'}});
		}
		return route.fulfill({status: 200, headers: {'Content-Type': 'text/event-stream'}, body: toSse(events)});
	}

	private async fallback(route: Route): Promise<void> {
		const request = route.request();
		this.unexpected.push(`${request.method()} ${new URL(request.url()).pathname}`);
		return request.method() === 'GET' ? route.fulfill({json: []}) : route.fulfill({status: 204});
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
