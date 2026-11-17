import {TextDecoder as NodeTextDecoder, TextEncoder as NodeTextEncoder} from 'util';
import {SseClientService, StreamHttpError} from './sse-client.service';
import {GatewayAuthService} from './gateway-auth.service';
import {SseEvent} from '../utils/sse-parser';

// Évite de charger les dépendances ESM (zas-design-system, nanoid) du vrai service.
jest.mock('./gateway-auth.service', () => ({GatewayAuthService: class {}}));

if (typeof globalThis.TextDecoder === 'undefined') {
	Object.assign(globalThis, {TextDecoder: NodeTextDecoder});
}

const encoder = new NodeTextEncoder();

interface FakeResponseInit {
	status?: number;
	chunks?: string[];
	headers?: Record<string, string>;
	json?: unknown;
}

const fakeResponse = ({status = 200, chunks = [], headers = {}, json}: FakeResponseInit) => {
	const queue = chunks.map(c => encoder.encode(c));
	return {
		json: () => (json === undefined ? Promise.reject(new SyntaxError('pas de JSON')) : Promise.resolve(json)),
		ok: status >= 200 && status < 300,
		status,
		statusText: status === 401 ? 'Unauthorized' : '',
		headers: {get: (name: string) => headers[name] ?? null},
		body: {
			getReader: () => ({
				read: () => Promise.resolve(queue.length ? {done: false, value: queue.shift()} : {done: true, value: undefined})
			})
		}
	};
};

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

describe('SseClientService', () => {
	let gateway: jest.Mocked<Pick<GatewayAuthService, 'isLocalhost' | 'requestHeaders' | 'checkSession' | 'refreshToken' | 'displayUnauthorized'>>;
	let client: SseClientService;
	let fetchMock: jest.Mock;

	beforeEach(() => {
		gateway = {
			isLocalhost: jest.fn().mockReturnValue(false),
			requestHeaders: jest.fn().mockReturnValue({blue: 'Bearer t', 'X-Correlation-Id': 'id'}),
			checkSession: jest.fn(),
			refreshToken: jest.fn(),
			displayUnauthorized: jest.fn()
		};
		client = new SseClientService(gateway as unknown as GatewayAuthService);
		fetchMock = jest.fn();
		Object.assign(globalThis, {fetch: fetchMock});
	});

	it('envoie les en-têtes de la gateway et émet les événements, y compris le reliquat en fin de flux', async () => {
		fetchMock.mockResolvedValue(fakeResponse({chunks: ['event:start\ndata:a\n\nda', 'ta:b\n\ndata:c'], headers: {blue: 'nouveau'}}));
		const received: SseEvent[] = [];
		let completed = false;

		client.post('/api', new FormData()).subscribe({next: d => received.push(d), complete: () => (completed = true)});
		await flush();

		expect(received).toEqual([
			{event: 'start', data: 'a'},
			{event: 'message', data: 'b'},
			{event: 'message', data: 'c'}
		]);
		expect(completed).toBe(true);
		const init = fetchMock.mock.calls[0][1];
		expect(init.headers).toEqual(expect.objectContaining({Accept: 'text/event-stream', blue: 'Bearer t', 'X-Correlation-Id': 'id'}));
		expect(gateway.refreshToken).toHaveBeenCalled();
		expect(gateway.checkSession).toHaveBeenCalled();
	});

	it('remonte une StreamHttpError si la réponse est en erreur', async () => {
		fetchMock.mockResolvedValue(fakeResponse({status: 500}));
		let error: unknown;

		client.post('/api', new FormData()).subscribe({error: e => (error = e)});
		await flush();

		expect(error).toBeInstanceOf(StreamHttpError);
		expect((error as StreamHttpError).status).toBe(500);
		expect(gateway.displayUnauthorized).not.toHaveBeenCalled();
	});

	it('expose le code métier d’un refus 409', async () => {
		fetchMock.mockResolvedValue(fakeResponse({status: 409, json: {STATUS: 409, MESSAGE: 'TURN_NOT_REPLACEABLE'}}));
		let error: unknown;

		client.post('/api', new FormData()).subscribe({error: e => (error = e)});
		await flush();

		expect((error as StreamHttpError).status).toBe(409);
		expect((error as StreamHttpError).code).toBe('TURN_NOT_REPLACEABLE');
	});

	it("affiche le dialogue d'authentification sur 401", async () => {
		fetchMock.mockResolvedValue(fakeResponse({status: 401}));
		let error: unknown;

		client.post('/api', new FormData()).subscribe({error: e => (error = e)});
		await flush();

		expect((error as StreamHttpError).status).toBe(401);
		expect(gateway.displayUnauthorized).toHaveBeenCalled();
	});

	it('annule la requête au désabonnement, sans émettre d’erreur', async () => {
		let signal: AbortSignal;
		fetchMock.mockImplementation(
			(_url: string, init: RequestInit) =>
				new Promise((_resolve, reject) => {
					signal = init.signal;
					signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
				})
		);
		const error = jest.fn();

		const subscription = client.post('/api', new FormData()).subscribe({error});
		subscription.unsubscribe();
		await flush();

		expect(signal.aborted).toBe(true);
		expect(error).not.toHaveBeenCalled();
	});
});
