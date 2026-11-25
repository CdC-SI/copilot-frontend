import {Locator, Page} from '@playwright/test';
import type {IPersonalDocument} from '../../src/app/shared/model/personal-document';
import {MockBackend} from './mock-backend';
import {MockResponse} from './mock-rest';

/** Fichier choisi dans la zone de dépôt du corpus. */
export interface CorpusFile {
	name: string;
	mimeType: string;
	buffer: Buffer;
}

/** Document personnel tel que renvoyé par `GET /documents/user-docs` (traité et actif par défaut). */
export function aPersonalDocument(document: Partial<IPersonalDocument> = {}): IPersonalDocument {
	return {title: 'guide-avs.pdf', uploadedAt: new Date(), status: 'PROCESSED', availabilityStatus: 'ACTIVE', timeToLiveInDays: 30, ...document};
}

/**
 * Documents personnels simulés, en mémoire : `GET /documents/user-docs`, `DELETE /documents/user-docs?filename=`,
 * `PUT /documents/user-docs/reactivate?filename=` et `POST /documents/upload` (ajoute le fichier envoyé, `PENDING`).
 * `uploadReplies` : réponses des prochains envois (erreur : `{status: 400, json: {MESSAGE: 'FILE_TOO_LARGE'}}`), consommées
 * dans l'ordre ; sans réponse prévue, l'envoi réussit.
 */
export class PersonalDocuments {
	readonly uploadReplies: MockResponse[] = [];

	private constructor(readonly items: IPersonalDocument[]) {}

	static async install(backend: MockBackend, items: IPersonalDocument[] = []): Promise<PersonalDocuments> {
		const documents = new PersonalDocuments(items);
		await backend.on('GET', '/documents/user-docs', () => ({json: documents.items}));
		await backend.on('DELETE', '/documents/user-docs', request => {
			const filename = new URL(request.url()).searchParams.get('filename');
			const index = documents.items.findIndex(document => document.title === filename);
			if (index < 0) return {status: 404};
			documents.items.splice(index, 1);
			return {status: 204};
		});
		await backend.on('PUT', '/documents/user-docs/reactivate', request => {
			const document = documents.find(new URL(request.url()).searchParams.get('filename') ?? '');
			if (!document) return {status: 404};
			Object.assign(document, {availabilityStatus: 'ACTIVE', timeToLiveInDays: 30});
			return {status: 204};
		});
		await backend.on('POST', '/documents/upload', request => {
			const reply = documents.uploadReplies.shift();
			if (reply) return reply;
			const filename = /filename="([^"]+)"/.exec(request.postDataBuffer()?.toString('utf8') ?? '')?.[1] ?? 'document.pdf';
			documents.items.push(aPersonalDocument({title: filename, status: 'PENDING', timeToLiveInDays: undefined}));
			return {status: 200};
		});
		return documents;
	}

	find(title: string): IPersonalDocument | undefined {
		return this.items.find(document => document.title === title);
	}
}

/** Verbe (fr) des actions des cartes du corpus ; leur nom accessible est « <verbe> <titre> ». */
type CardAction = 'Ouvrir' | 'Télécharger' | 'Supprimer' | 'Réactiver' | 'Supprimer la demande';

/** Page « Corpus documentaire » (`/corpus`) : documents personnels, sources officielles et demandes de sources. */
export class CorpusPage {
	readonly uploadButton: Locator;

	constructor(private readonly page: Page) {
		this.uploadButton = this.tabPanel('Mes documents').getByRole('button', {name: /^Téléverser \d+ document\(s\)$/});
	}

	async open(): Promise<void> {
		await this.page.goto('/corpus');
		await this.page.getByRole('heading', {name: 'Corpus documentaire', level: 2}).waitFor();
	}

	tabPanel(name: string): Locator {
		return this.page.getByRole('tabpanel', {name});
	}

	async openTab(name: string): Promise<void> {
		await this.page.getByRole('tab', {name}).click();
	}

	/** Choisit des fichiers via la zone de dépôt (champ fichier masqué d'Oblique). */
	async chooseFiles(...files: CorpusFile[]): Promise<void> {
		await this.page.locator('ob-file-upload input[type="file"]').setInputFiles(files);
	}

	/** Fichier choisi, en attente d'envoi (« nom (n KB) »). */
	queuedFile(name: string): Locator {
		return this.tabPanel('Mes documents').getByRole('listitem').filter({hasText: name});
	}

	/** Carte d'un document personnel (identifiée par son titre). */
	document(title: string): Locator {
		return this.page.locator('mat-card').filter({has: this.page.getByText(title, {exact: true})});
	}

	/** Bouton d'action d'une carte (document ou demande), par son nom accessible « <verbe> <titre> ». */
	action(card: Locator, verb: CardAction): Locator {
		return card.getByRole('button', {name: new RegExp(`^${verb} `)});
	}

	/** Recharge la liste des documents. */
	async refreshDocuments(): Promise<void> {
		await this.page.getByRole('button', {name: 'Actualiser mes documents'}).click();
	}

	/** Panneau d'un workspace ou d'une source dans l'onglet « Sources officielles » (en-tête d'accordéon). */
	panelHeader(name: string | RegExp): Locator {
		return this.tabPanel('Sources officielles').getByRole('button', {name});
	}
}
