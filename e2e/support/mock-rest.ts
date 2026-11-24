import {Request, Route} from '@playwright/test';

/** Promesse résolue par le test : retient une réponse du backend simulé (état intermédiaire observable). */
export function gate(): {promise: Promise<void>; open: () => void} {
	let open!: () => void;
	const promise = new Promise<void>(resolve => (open = resolve));
	return {promise, open};
}

/** Requête reçue par le backend simulé (toutes les requêtes `/zia/api/**`, dans l'ordre d'émission). */
export interface ApiRequest {
	method: string;
	/** Chemin après `/zia/api` (ex. `/workspaces/RH`), décodé. */
	path: string;
	query: Record<string, string>;
	/** Corps JSON, texte brut, ou `undefined` (sans corps). Corps multipart : texte brut (latin1). */
	body?: unknown;
}

/** Réponse d'une route déclarée par `on` : JSON, ou fichier (`body` + `contentType`), statut 200 par défaut. */
export interface MockResponse {
	status?: number;
	json?: unknown;
	body?: Buffer;
	contentType?: string;
}

/**
 * Ressource REST simulée en mémoire (`collection`) : `GET <path>` (liste), `GET|PUT|DELETE <path>/{clé}` et `POST <path>`.
 * Les modifications sont appliquées à `items` : la page relit l'état à jour.
 */
export class MockCollection<T extends object> {
	constructor(
		readonly items: T[],
		private readonly key: keyof T,
		private readonly create: (body: Partial<T>) => T
	) {}

	find(id: string): T | undefined {
		return this.items.find(item => String(item[this.key]) === id);
	}

	handle(method: string, id: string | undefined, body: Partial<T>): MockResponse {
		if (id === undefined) {
			if (method === 'GET') return {json: this.items};
			if (method !== 'POST') return {status: 405};
			const created = this.create(body);
			this.items.push(created);
			return {status: 201, json: created};
		}
		const index = this.items.findIndex(item => String(item[this.key]) === id);
		if (index < 0) return {status: 404, json: {MESSAGE: 'NOT_FOUND'}};
		if (method === 'GET') return {json: this.items[index]};
		if (method === 'DELETE') {
			this.items.splice(index, 1);
			return {status: 204};
		}
		if (method === 'PUT') {
			this.items[index] = {...this.items[index], ...body};
			return {json: this.items[index]};
		}
		return {status: 405};
	}
}

/** Réponse d'une route simulée : fichier, JSON ou statut seul. */
export function fulfill(route: Route, {status = 200, json, body, contentType}: MockResponse): Promise<void> {
	if (body) return route.fulfill({status, body, contentType});
	return json === undefined ? route.fulfill({status}) : route.fulfill({status, json});
}

export function escapeRegExp(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Corps d'une requête : JSON si possible, sinon texte (latin1, pour les corps multipart). */
export function requestBody(request: Request): unknown {
	const buffer = request.postDataBuffer();
	if (!buffer) return undefined;
	const text = buffer.toString('latin1');
	try {
		return JSON.parse(buffer.toString('utf8'));
	} catch {
		return text;
	}
}
