import {Page} from '@playwright/test';
import type {ChatStreamEvent} from '../../src/app/shared/model/chat-stream-event';
import {toSse} from '../../src/testing/stream-events';

/** Question reçue par `POST /conversations` (FormData multipart). */
export interface ChatRequestRecord {
	query: string;
	conversationId?: string;
	replaceMessageId?: string;
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
