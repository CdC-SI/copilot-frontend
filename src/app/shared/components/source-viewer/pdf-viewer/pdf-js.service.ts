import {Injectable} from '@angular/core';
import type {PDFDocumentLoadingTask, PDFDocumentProxy, PDFPageProxy, PageViewport} from 'pdfjs-dist';

type PdfJs = typeof import('pdfjs-dist');

/** Dossier des ressources de pdf.js copiées par le build (`angular.json`, `assets/pdfjs`). */
const ASSETS = 'assets/pdfjs/';

/** Ouverture d'un PDF (annulable) : `destroy` interrompt le chargement ou libère le document et son worker. */
export interface PdfLoadingTask {
	promise: Promise<PDFDocumentProxy>;
	destroy: () => Promise<void>;
}

/** Rendu d'une couche texte en cours (annulable). */
export interface TextLayerTask {
	promise: Promise<HTMLElement[]>;
	cancel: () => void;
}

/**
 * Accès à pdf.js, chargé à la demande (chunk séparé) : le worker est bundlé par le build (`pdf-worker.ts`) et les
 * ressources (CMaps, polices standard, décodeurs WASM, profils ICC) sont servies par l'application elle-même, sans CDN.
 */
@Injectable({
	providedIn: 'root'
})
export class PdfJsService {
	private module?: Promise<PdfJs>;
	/**
	 * Destructions de documents en cours : le worker est partagé (`workerPort`) et pdf.js refuse d'y ouvrir un
	 * document tant qu'une destruction n'est pas terminée (« the worker is being destroyed »).
	 */
	private teardown: Promise<void> = Promise.resolve();

	/** Ouvre un PDF ; `data` est transféré au worker (le tableau est vidé). */
	open(data: Uint8Array): PdfLoadingTask {
		let task: PDFDocumentLoadingTask | undefined;
		let destroyed = false;
		const promise = this.load().then(async pdfjs => {
			await this.teardown;
			if (destroyed) throw abortError();
			task = this.getDocument(pdfjs, data);
			return task.promise;
		});
		return {
			promise,
			destroy: async () => {
				destroyed = true;
				const destruction = task?.destroy();
				if (!destruction) return;
				const previous = this.teardown;
				this.teardown = destruction.then(
					() => previous,
					() => previous
				);
				await destruction;
			}
		};
	}

	/** Couche texte transparente d'une page (sélection du texte et surlignage du passage cité). */
	renderTextLayer(page: PDFPageProxy, container: HTMLElement, viewport: PageViewport): TextLayerTask {
		let cancelled = false;
		let layer: InstanceType<PdfJs['TextLayer']> | undefined;
		const promise = this.load().then(async pdfjs => {
			if (cancelled) return [];
			layer = new pdfjs.TextLayer({textContentSource: page.streamTextContent(), container, viewport});
			await layer.render();
			return layer.textDivs;
		});
		return {
			promise,
			cancel: () => {
				cancelled = true;
				layer?.cancel();
			}
		};
	}

	/** Un rendu annulé par pdf.js (changement de page, fermeture) n'est pas une erreur. */
	isCancellation(error: unknown): boolean {
		const name = (error as {name?: string} | null)?.name;
		return name === 'RenderingCancelledException' || name === 'AbortException';
	}

	private getDocument(pdfjs: PdfJs, data: Uint8Array): PDFDocumentLoadingTask {
		const base = new URL(ASSETS, document.baseURI).href;
		return pdfjs.getDocument({
			data,
			cMapUrl: `${base}cmaps/`,
			standardFontDataUrl: `${base}standard_fonts/`,
			wasmUrl: `${base}wasm/`,
			iccUrl: `${base}iccs/`,
			enableXfa: false
		});
	}

	private load(): Promise<PdfJs> {
		this.module ??= Promise.all([import('pdfjs-dist'), import('./pdf-worker')]).then(([pdfjs, {createPdfWorker}]) => {
			pdfjs.GlobalWorkerOptions.workerPort = createPdfWorker();
			return pdfjs;
		});
		return this.module;
	}
}

/** Ouverture interrompue avant le chargement de pdf.js (même nom que l'annulation de pdf.js). */
function abortError(): Error {
	const error = new Error('Chargement du PDF annulé');
	error.name = 'AbortException';
	return error;
}
