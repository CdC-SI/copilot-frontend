import {ChangeDetectionStrategy, Component, DestroyRef, ElementRef, effect, inject, input, signal, untracked, viewChild} from '@angular/core';
import {MatIconButton} from '@angular/material/button';
import {MatIcon} from '@angular/material/icon';
import {MatTooltip} from '@angular/material/tooltip';
import {TranslatePipe} from '@ngx-translate/core';
import type {PDFDocumentProxy, RenderTask} from 'pdfjs-dist';
import {findExcerptItems} from '../../../utils/excerpt-match';
import {PdfJsService, TextLayerTask} from './pdf-js.service';

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.25;
/** Largeur retenue si le composant n'est pas encore mis en page (rendu masqué). */
const FALLBACK_WIDTH = 640;
/** Marge intérieure de la zone de défilement (px, voir le style). */
const HORIZONTAL_PADDING = 32;

/**
 * Visionneuse PDF (pdf.js) : une page à la fois, ajustée à la largeur, avec navigation et zoom. La couche texte
 * permet la sélection et le surlignage du passage cité (`highlight`), recherché sur la page affichée.
 */
@Component({
	selector: 'zco-pdf-viewer',
	templateUrl: './pdf-viewer.component.html',
	styleUrl: './pdf-viewer.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [MatIconButton, MatIcon, MatTooltip, TranslatePipe]
})
export class PdfViewerComponent {
	/** Contenu du PDF (copié avant transfert au worker). */
	readonly data = input.required<Uint8Array>();
	/** Page affichée à l'ouverture (1 par défaut). */
	readonly page = input(1);
	/** Passage cité à surligner (texte du chunk). */
	readonly highlight = input<string | undefined>(undefined);
	readonly status = signal<'loading' | 'ready' | 'error'>('loading');
	readonly currentPage = signal(1);
	readonly pageCount = signal(0);
	readonly zoom = signal(1);
	/** Passage cité repéré sur la page affichée ; `null` sans passage à chercher. */
	readonly passageFound = signal<boolean | null>(null);
	private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
	private readonly textLayer = viewChild.required<ElementRef<HTMLElement>>('textLayer');
	private readonly pageView = viewChild.required<ElementRef<HTMLElement>>('pageView');
	private readonly pdfJs = inject(PdfJsService);
	private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
	private pdf?: PDFDocumentProxy;
	private renderTask?: RenderTask;
	private textTask?: TextLayerTask;
	/** Invalide les chargements et rendus asynchrones devenus obsolètes. */
	private loadId = 0;
	private renderId = 0;

	constructor() {
		effect(() => {
			const data = this.data();
			const page = this.page();
			untracked(() => {
				void this.load(data, page);
			});
		});
		inject(DestroyRef).onDestroy(() => {
			this.loadId++;
			this.renderId++;
			this.cancelRendering();
			void this.pdf?.loadingTask.destroy();
		});
	}

	previousPage(): void {
		this.goTo(this.currentPage() - 1);
	}

	nextPage(): void {
		this.goTo(this.currentPage() + 1);
	}

	zoomIn(): void {
		this.setZoom(this.zoom() + ZOOM_STEP);
	}

	zoomOut(): void {
		this.setZoom(this.zoom() - ZOOM_STEP);
	}

	get canZoomIn(): boolean {
		return this.zoom() < MAX_ZOOM;
	}

	get canZoomOut(): boolean {
		return this.zoom() > MIN_ZOOM;
	}

	private goTo(page: number): void {
		if (!this.pdf || page < 1 || page > this.pageCount() || page === this.currentPage()) return;
		this.currentPage.set(page);
		void this.render();
	}

	private setZoom(zoom: number): void {
		const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
		if (next === this.zoom()) return;
		this.zoom.set(next);
		void this.render();
	}

	private async load(data: Uint8Array, page: number): Promise<void> {
		const loadId = ++this.loadId;
		this.renderId++;
		this.cancelRendering();
		void this.pdf?.loadingTask.destroy();
		this.pdf = undefined;
		this.status.set('loading');
		this.passageFound.set(null);
		try {
			const pdf = await this.pdfJs.open(data.slice());
			if (loadId !== this.loadId) {
				void pdf.loadingTask.destroy();
				return;
			}
			this.pdf = pdf;
			this.pageCount.set(pdf.numPages);
			this.currentPage.set(Math.min(Math.max(1, Math.trunc(page) || 1), pdf.numPages));
			this.status.set('ready');
			await this.render();
		} catch (error) {
			if (loadId === this.loadId && !this.pdfJs.isCancellation(error)) this.status.set('error');
		}
	}

	private async render(): Promise<void> {
		const pdf = this.pdf;
		if (!pdf) return;
		const renderId = ++this.renderId;
		this.cancelRendering();
		try {
			const page = await pdf.getPage(this.currentPage());
			if (renderId !== this.renderId) return;
			const width = (this.host.nativeElement.clientWidth || FALLBACK_WIDTH) - HORIZONTAL_PADDING;
			const scale = (Math.max(width, 200) / page.getViewport({scale: 1}).width) * this.zoom();
			const viewport = page.getViewport({scale});
			const ratio = window.devicePixelRatio || 1;
			const canvas = this.canvas().nativeElement;
			canvas.width = Math.floor(viewport.width * ratio);
			canvas.height = Math.floor(viewport.height * ratio);
			const pageView = this.pageView().nativeElement;
			pageView.style.width = `${Math.floor(viewport.width)}px`;
			pageView.style.height = `${Math.floor(viewport.height)}px`;
			pageView.style.setProperty('--scale-factor', String(scale));
			pageView.style.setProperty('--total-scale-factor', String(scale));
			this.renderTask = page.render({canvas, viewport, transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0]});
			await this.renderTask.promise;
			if (renderId !== this.renderId) return;
			const container = this.textLayer().nativeElement;
			container.replaceChildren();
			this.textTask = this.pdfJs.renderTextLayer(page, container, viewport);
			const textDivs = await this.textTask.promise;
			if (renderId !== this.renderId) return;
			this.markPassage(textDivs);
		} catch (error) {
			if (renderId === this.renderId && !this.pdfJs.isCancellation(error)) this.status.set('error');
		}
	}

	private markPassage(textDivs: HTMLElement[]): void {
		const excerpt = this.highlight();
		if (!excerpt) {
			this.passageFound.set(null);
			return;
		}
		const indexes = findExcerptItems(
			textDivs.map(div => div.textContent ?? ''),
			excerpt
		);
		indexes.forEach(index => textDivs[index].classList.add('highlight'));
		this.passageFound.set(indexes.length > 0);
		if (indexes.length) textDivs[indexes[0]].scrollIntoView?.({block: 'center'});
	}

	private cancelRendering(): void {
		this.renderTask?.cancel();
		this.renderTask = undefined;
		this.textTask?.cancel();
		this.textTask = undefined;
	}
}
