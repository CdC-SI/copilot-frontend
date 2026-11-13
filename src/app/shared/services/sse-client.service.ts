import {Injectable} from '@angular/core';
import {Observable, Subscriber} from 'rxjs';
import {GatewayAuthService} from './gateway-auth.service';
import {SseParser} from '../utils/sse-parser';

/** Réponse HTTP en erreur (4xx/5xx) reçue à l'ouverture d'un flux. */
export class StreamHttpError extends Error {
	constructor(
		readonly status: number,
		readonly statusText: string
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

	post(url: string, body: FormData): Observable<string> {
		return new Observable<string>(subscriber => {
			const controller = new AbortController();
			this.stream(url, body, controller.signal, subscriber).catch((error: unknown) => {
				if (!controller.signal.aborted) {
					subscriber.error(error);
				}
			});
			return () => controller.abort();
		});
	}

	private async stream(url: string, body: FormData, signal: AbortSignal, subscriber: Subscriber<string>): Promise<void> {
		const headers = {Accept: 'text/event-stream', ...this.gatewayAuth.requestHeaders()};
		const response = await fetch(url, {method: 'POST', headers, body, signal});
		this.checkResponse(response);

		const reader = response.body.getReader();
		const decoder = new TextDecoder('utf-8');
		const parser = new SseParser();
		const emit = (events: string[]) => events.forEach(event => subscriber.next(event));

		let chunk = await reader.read();
		while (!chunk.done) {
			emit(parser.push(decoder.decode(chunk.value, {stream: true})));
			chunk = await reader.read();
		}
		emit(parser.push(decoder.decode()));
		emit(parser.flush());
		subscriber.complete();
	}

	private checkResponse(response: Response): void {
		if (!this.gatewayAuth.isLocalhost()) {
			this.gatewayAuth.checkSession();
			this.gatewayAuth.refreshToken(response.headers);
		}
		if (!response.ok) {
			if (response.status === 401 && !this.gatewayAuth.isLocalhost()) {
				this.gatewayAuth.displayUnauthorized();
			}
			throw new StreamHttpError(response.status, response.statusText);
		}
		if (!response.body) {
			throw new Error('Réponse de streaming sans corps');
		}
	}
}
