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
 * Accès à pdf.js, chargé à la demande (chunk séparé) : le worker et les ressources (CMaps, polices standard,
 * décodeurs WASM, profils ICC) sont servis par l'application elle-même, sans CDN.
 */
@Injectable({
	providedIn: 'root'
})
export class PdfJsService {
	private module?: Promise<PdfJs>;

	/** Ouvre un PDF ; `data` est transféré au worker (le tableau est vidé). */
	open(data: Uint8Array): PdfLoadingTask {
		let task: PDFDocumentLoadingTask | undefined;
		let destroyed = false;
		const promise = this.load().then(pdfjs => {
			if (destroyed) throw abortError();
			task = this.getDocument(pdfjs, data);
			return task.promise;
		});
		return {
			promise,
			destroy: async () => {
				destroyed = true;
				await task?.destroy();
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
		this.module ??= import('pdfjs-dist').then(pdfjs => {
			pdfjs.GlobalWorkerOptions.workerSrc = new URL(`${ASSETS}pdf.worker.min.mjs`, document.baseURI).href;
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
