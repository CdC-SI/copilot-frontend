import {Injectable} from '@angular/core';
import type {PDFDocumentProxy, PDFPageProxy, PageViewport} from 'pdfjs-dist';

type PdfJs = typeof import('pdfjs-dist');

/** Dossier des ressources de pdf.js copiées par le build (`angular.json`, `assets/pdfjs`). */
const ASSETS = 'assets/pdfjs/';

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
	async open(data: Uint8Array): Promise<PDFDocumentProxy> {
		const pdfjs = await this.load();
		const base = new URL(ASSETS, document.baseURI).href;
		return pdfjs.getDocument({
			data,
			cMapUrl: `${base}cmaps/`,
			standardFontDataUrl: `${base}standard_fonts/`,
			wasmUrl: `${base}wasm/`,
			iccUrl: `${base}iccs/`,
			enableXfa: false
		}).promise;
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

	private load(): Promise<PdfJs> {
		this.module ??= import('pdfjs-dist').then(pdfjs => {
			pdfjs.GlobalWorkerOptions.workerSrc = new URL(`${ASSETS}pdf.worker.min.mjs`, document.baseURI).href;
			return pdfjs;
		});
		return this.module;
	}
}
