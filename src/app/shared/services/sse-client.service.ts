import {Injectable} from '@angular/core';
import {Observable, Subscriber} from 'rxjs';
import {GatewayAuthService} from './gateway-auth.service';
import {SseEvent, SseParser} from '../utils/sse-parser';

/** Réponse HTTP en erreur (4xx/5xx) reçue à l'ouverture d'un flux. */
export class StreamHttpError extends Error {
	constructor(
		readonly status: number,
		readonly statusText: string,
		/** Code d'erreur métier renvoyé par le backend (champ `MESSAGE`), ex. `TURN_NOT_REPLACEABLE`. */
		readonly code?: string
	) {
		super(`HTTP ${status} ${statusText}`.trim());
		this.name = 'StreamHttpError';
	}
}

/**
 * Client de streaming SSE en POST (fetch), avec les mêmes en-têtes que les appels HttpClient.
 * Se désabonner de l'Observable annule la requête (AbortController).
 */
@Injectable({providedIn: 'root'})
export class SseClientService {
	constructor(private readonly gatewayAuth: GatewayAuthService) {}

	post(url: string, body: FormData): Observable<SseEvent> {
		return new Observable<SseEvent>(subscriber => {
			const controller = new AbortController();
			this.stream(url, body, controller.signal, subscriber).catch((error: unknown) => {
				if (!controller.signal.aborted) {
					subscriber.error(error);
				}
			});
			return () => controller.abort();
		});
	}

	private async stream(url: string, body: FormData, signal: AbortSignal, subscriber: Subscriber<SseEvent>): Promise<void> {
		const headers = {Accept: 'text/event-stream', ...this.gatewayAuth.requestHeaders()};
		const response = await fetch(url, {method: 'POST', headers, body, signal});
		await this.checkResponse(response);

		const reader = response.body.getReader();
		const decoder = new TextDecoder('utf-8');
		const parser = new SseParser();
		const emit = (events: SseEvent[]) => events.forEach(event => subscriber.next(event));

		let chunk = await reader.read();
		while (!chunk.done) {
			emit(parser.push(decoder.decode(chunk.value, {stream: true})));
			chunk = await reader.read();
		}
		emit(parser.push(decoder.decode()));
		emit(parser.flush());
		subscriber.complete();
	}

	private async checkResponse(response: Response): Promise<void> {
		if (!this.gatewayAuth.isLocalhost()) {
			this.gatewayAuth.checkSession();
			this.gatewayAuth.refreshToken(response.headers);
		}
		if (!response.ok) {
			if (response.status === 401 && !this.gatewayAuth.isLocalhost()) {
				this.gatewayAuth.displayUnauthorized();
			}
			throw new StreamHttpError(response.status, response.statusText, await this.readErrorCode(response));
		}
		if (!response.body) {
			throw new Error('Réponse de streaming sans corps');
		}
	}

	private async readErrorCode(response: Response): Promise<string | undefined> {
		try {
			const body = (await response.json()) as {MESSAGE?: unknown};
			return typeof body?.MESSAGE === 'string' ? body.MESSAGE : undefined;
		} catch {
			return undefined;
		}
	}
}
