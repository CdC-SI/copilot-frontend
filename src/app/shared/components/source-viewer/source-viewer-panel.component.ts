import {CdkTrapFocus} from '@angular/cdk/a11y';
import {NgTemplateOutlet} from '@angular/common';
import {
	ChangeDetectionStrategy,
	Component,
	ElementRef,
	HostListener,
	Injector,
	afterNextRender,
	computed,
	effect,
	inject,
	input,
	signal,
	viewChild
} from '@angular/core';
import {takeUntilDestroyed, toObservable} from '@angular/core/rxjs-interop';
import {MatButton, MatIconButton} from '@angular/material/button';
import {MatIcon} from '@angular/material/icon';
import {MatTooltip} from '@angular/material/tooltip';
import {TranslatePipe} from '@ngx-translate/core';
import {ObNotificationService} from '@oblique/oblique';
import {HttpErrorResponse} from '@angular/common/http';
import {Observable, Subject, catchError, concat, from, map, merge, of, startWith, switchMap} from 'rxjs';
import {SourceView} from '../../model/source-view';
import {SourceDocumentService} from '../../services/source-document.service';
import {downloadBlob, openOrDownloadBlob} from '../../utils/file-download.utils';
import {PdfViewerComponent} from './pdf-viewer/pdf-viewer.component';
import {SourceViewerStore, SourceViewerTarget} from './source-viewer.store';

/** Contenu chargé pour la cible du panneau. */
interface PanelContent {
	status: 'idle' | 'loading' | 'ready' | 'notFound' | 'error';
	view?: SourceView;
	/** Fichier PDF affiché dans la visionneuse. */
	pdf?: Uint8Array;
	pdfStatus?: 'loading' | 'ready' | 'error';
}

const IDLE: PanelContent = {status: 'idle'};
const PDF_MIME_TYPE = 'application/pdf';

/**
 * Panneau latéral des sources : métadonnées, extrait cité et contenu selon le type de source (visionneuse PDF à la
 * page citée avec le passage surligné, téléchargement, page d'origine, lien BPanda). Placé par la page hôte, qui
 * fournit le `SourceViewerStore`. En surcouche (`overlay`), le focus reste dans le panneau ; la page rend inerte le
 * contenu recouvert.
 */
@Component({
	selector: 'zco-source-viewer-panel',
	templateUrl: './source-viewer-panel.component.html',
	styleUrl: './source-viewer-panel.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NgTemplateOutlet, PdfViewerComponent, MatButton, MatIconButton, MatIcon, MatTooltip, TranslatePipe],
	hostDirectives: [CdkTrapFocus],
	host: {
		role: 'complementary',
		'[attr.aria-labelledby]': '"source-viewer-title"'
	}
})
export class SourceViewerPanelComponent {
	/** Panneau en surcouche du contenu de la page : le focus y est confiné. */
	readonly overlay = input(false);
	readonly content = signal<PanelContent>(IDLE);
	readonly citation = computed(() => {
		const target = this.store.target();
		return target?.kind === 'source' ? target.source.citation : undefined;
	});
	readonly title = computed(() => {
		const target = this.store.target();
		if (!target) return '';
		if (target.kind === 'file') return target.title;
		return this.content().view?.title || target.source.title || fileName(target.source.link);
	});
	/** Page citée (première page numérique de la métadonnée), 1 par défaut. */
	readonly page = computed(() => parsePage(this.content().view?.pageNumber ?? this.sourcePageNumber()));
	/** Page d'origine, à la page citée si c'est un PDF (`#page=N`). */
	readonly originalUrl = computed(() => withPdfPage(this.content().view?.url, this.content().view?.pageNumber));
	readonly downloading = signal(false);
	protected readonly store = inject(SourceViewerStore);
	private readonly heading = viewChild<ElementRef<HTMLElement>>('heading');
	private readonly sourceService = inject(SourceDocumentService);
	private readonly notifService = inject(ObNotificationService);
	private readonly injector = inject(Injector);
	private readonly retries = new Subject<void>();

	constructor() {
		const focusTrap = inject(CdkTrapFocus, {self: true});
		effect(() => (focusTrap.enabled = this.overlay()));
		// Un seul flux annulable : changement de cible et nouvel essai remplacent le chargement en cours.
		merge(toObservable(this.store.target), this.retries.pipe(map(() => this.store.target())))
			.pipe(
				switchMap(target => (target ? this.load(target) : of(IDLE))),
				takeUntilDestroyed()
			)
			.subscribe(content => this.content.set(content));
		effect(() => {
			if (this.store.target()) {
				afterNextRender(() => this.heading()?.nativeElement.focus({preventScroll: true}), {injector: this.injector});
			}
		});
	}

	/** Échap dans le panneau le ferme (sans arrêter une génération en cours). */
	@HostListener('keydown.escape', ['$event'])
	onEscape(event: Event): void {
		event.stopPropagation();
		this.store.close();
	}

	retry(): void {
		this.retries.next();
	}

	download(): void {
		const target = this.store.target();
		const {view, pdf} = this.content();
		if (!target || !view) return;
		const filename = this.title();
		if (pdf) {
			downloadBlob(new Blob([pdf as BlobPart], {type: PDF_MIME_TYPE}), filename);
			return;
		}
		this.downloading.set(true);
		const file$ = target.kind === 'file' ? target.load() : this.sourceService.getFile(view.id);
		file$.subscribe({
			next: blob => {
				this.downloading.set(false);
				downloadBlob(blob, filename);
			},
			error: () => {
				this.downloading.set(false);
				this.notifService.error('sourceViewer.downloadError');
			}
		});
	}

	/** Visionneuse native du navigateur (impression, recherche dans tout le document). */
	openInNewTab(): void {
		const {pdf} = this.content();
		if (pdf) openOrDownloadBlob(new Blob([pdf as BlobPart], {type: PDF_MIME_TYPE}), this.title());
	}

	private sourcePageNumber(): string | undefined {
		const target = this.store.target();
		return target?.kind === 'source' ? target.source.pageNumber : undefined;
	}

	private load(target: SourceViewerTarget): Observable<PanelContent> {
		if (target.kind === 'file') {
			const view = fileView(target.title);
			return view.display === 'PDF' ? this.withPdf(view, target.load()) : of({status: 'ready', view});
		}
		const id = target.source.documentId;
		return this.sourceService.getView(id).pipe(
			switchMap(view =>
				view.display === 'PDF' && view.fileAvailable ? this.withPdf(view, this.sourceService.getFile(id)) : of<PanelContent>({status: 'ready', view})
			),
			startWith<PanelContent>({status: 'loading'}),
			catchError((error: unknown) => of<PanelContent>({status: error instanceof HttpErrorResponse && error.status === 404 ? 'notFound' : 'error'}))
		);
	}

	private withPdf(view: SourceView, file$: Observable<Blob>): Observable<PanelContent> {
		return concat(
			of<PanelContent>({status: 'ready', view, pdfStatus: 'loading'}),
			file$.pipe(
				switchMap(blob => from(blob.arrayBuffer())),
				map((buffer): PanelContent => ({status: 'ready', view, pdf: new Uint8Array(buffer), pdfStatus: 'ready'})),
				catchError(() => of<PanelContent>({status: 'ready', view, pdfStatus: 'error'}))
			)
		);
	}
}

/** Vue locale d'un document déjà identifié (corpus) : PDF dans la visionneuse, sinon téléchargement. */
function fileView(title: string): SourceView {
	return {
		id: '',
		origin: 'DOCUMENT',
		display: title.toLowerCase().endsWith('.pdf') ? 'PDF' : 'DOWNLOAD',
		title,
		excerptTruncated: false,
		fileAvailable: true
	};
}

function fileName(path: string | undefined): string {
	return path?.split('/').pop() ?? '';
}

export function parsePage(pageNumber: string | undefined): number {
	const page = Number.parseInt(/\d+/.exec(pageNumber ?? '')?.[0] ?? '', 10);
	return page > 0 ? page : 1;
}

export function withPdfPage(url: string | undefined, pageNumber: string | undefined): string | undefined {
	if (!url) return undefined;
	const page = /\d+/.exec(pageNumber ?? '')?.[0];
	try {
		const parsed = new URL(url);
		if (!page || parsed.hash || !parsed.pathname.toLowerCase().endsWith('.pdf')) return url;
		parsed.hash = `page=${page}`;
		return parsed.toString();
	} catch {
		return url;
	}
}
