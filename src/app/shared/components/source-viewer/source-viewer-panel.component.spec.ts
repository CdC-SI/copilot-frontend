import {HttpErrorResponse} from '@angular/common/http';
import {Component, input} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {MatIcon} from '@angular/material/icon';
import {provideTranslateService} from '@ngx-translate/core';
import {Observable, Subject, of, throwError} from 'rxjs';
import {NotificationMock, notificationMock, provideNotificationMock} from '../../../../testing/angular';
import {aSource} from '../../../../testing/stream-events';
import {SourceView} from '../../model/source-view';
import {SourceDocumentService} from '../../services/source-document.service';
import * as fileDownload from '../../utils/file-download.utils';
import {PdfViewerComponent} from './pdf-viewer/pdf-viewer.component';
import {SourceViewerPanelComponent, parsePage, withPdfPage} from './source-viewer-panel.component';
import {SourceViewerStore} from './source-viewer.store';

@Component({selector: 'zco-pdf-viewer', template: ''})
class PdfViewerStubComponent {
	readonly data = input.required<Uint8Array>();
	readonly page = input(1);
	readonly highlight = input<string | undefined>(undefined);
}

@Component({selector: 'mat-icon', template: ''})
class MatIconStubComponent {
	readonly svgIcon = input<string>();
}

/** Blob dont le contenu est lisible : `Blob.arrayBuffer` n'est pas implémenté par jsdom. */
const fileBlob = (content: string): Blob => {
	const bytes = new TextEncoder().encode(content);
	const blob = new Blob([bytes]);
	Object.defineProperty(blob, 'arrayBuffer', {value: async () => Promise.resolve(bytes.buffer)});
	return blob;
};

const view = (patch: Partial<SourceView> = {}): SourceView => ({
	id: 'chunk-1',
	origin: 'DOCUMENT',
	display: 'PDF',
	title: 'directive-avs.pdf',
	pageNumber: '12',
	subsection: '2.1 Cotisations',
	version: 'v2024',
	state: 'en vigueur',
	excerpt: 'Les cotisations sont dues dès 18 ans.',
	excerptTruncated: false,
	fileAvailable: true,
	...patch
});

describe('SourceViewerPanelComponent', () => {
	let fixture: ComponentFixture<SourceViewerPanelComponent>;
	let store: SourceViewerStore;
	let notifications: NotificationMock;
	let sourceService: {getView: jest.Mock; getFile: jest.Mock};
	const element = (): HTMLElement => fixture.nativeElement;
	const query = <T extends Element = HTMLElement>(selector: string): T | null => element().querySelector<T>(selector);
	const text = (): string => element().textContent?.replace(/\s+/g, ' ') ?? '';
	const pdfViewer = (): PdfViewerStubComponent | undefined =>
		fixture.debugElement.query(debug => debug.componentInstance instanceof PdfViewerStubComponent)?.componentInstance;

	const settle = async (): Promise<void> => {
		fixture.detectChanges();
		await fixture.whenStable();
		await new Promise(resolve => setTimeout(resolve));
		fixture.detectChanges();
	};

	beforeEach(() => {
		jest.spyOn(fileDownload, 'downloadBlob').mockImplementation(() => undefined);
		jest.spyOn(fileDownload, 'openOrDownloadBlob').mockImplementation(() => undefined);
		notifications = notificationMock();
		sourceService = {getView: jest.fn(), getFile: jest.fn(() => of(fileBlob('%PDF-1.7')))};
		TestBed.configureTestingModule({
			imports: [SourceViewerPanelComponent],
			providers: [
				SourceViewerStore,
				provideTranslateService(),
				provideNotificationMock(notifications),
				{provide: SourceDocumentService, useValue: sourceService}
			]
		});
		TestBed.overrideComponent(SourceViewerPanelComponent, {
			remove: {imports: [PdfViewerComponent, MatIcon]},
			add: {imports: [PdfViewerStubComponent, MatIconStubComponent]}
		});
		store = TestBed.inject(SourceViewerStore);
		fixture = TestBed.createComponent(SourceViewerPanelComponent);
	});

	afterEach(() => {
		fixture.destroy();
		jest.restoreAllMocks();
	});

	it('affiche un PDF à la page citée avec le passage à surligner, et l’extrait repliable', async () => {
		sourceService.getView.mockReturnValue(of(view()));
		store.open(aSource({documentId: 'chunk-1', citation: 3, pageNumber: '12'}));
		await settle();

		expect(sourceService.getView).toHaveBeenCalledWith('chunk-1');
		expect(sourceService.getFile).toHaveBeenCalledWith('chunk-1');
		expect(query('#source-viewer-title')?.textContent).toContain('directive-avs.pdf');
		expect(query('.viewer-citation')?.textContent?.trim()).toBe('3');
		expect(text()).toContain('2.1 Cotisations');
		expect(text()).toContain('en vigueur');
		expect(query('details.viewer-excerpt-details blockquote')?.textContent).toBe('Les cotisations sont dues dès 18 ans.');
		expect(pdfViewer()?.page()).toBe(12);
		expect(pdfViewer()?.highlight()).toBe('Les cotisations sont dues dès 18 ans.');
		expect(Array.from(pdfViewer()?.data() ?? [])).toEqual(Array.from(new TextEncoder().encode('%PDF-1.7')));
		expect(document.activeElement).toBe(query('#source-viewer-title'));
	});

	it('télécharge et ouvre dans un onglet le PDF déjà chargé, sans nouvelle requête', async () => {
		sourceService.getView.mockReturnValue(of(view()));
		store.open(aSource({documentId: 'chunk-1'}));
		await settle();

		query<HTMLButtonElement>('.viewer-download')?.click();
		query<HTMLButtonElement>('.viewer-open-tab')?.click();

		expect(sourceService.getFile).toHaveBeenCalledTimes(1);
		expect(fileDownload.downloadBlob).toHaveBeenCalledWith(expect.any(Blob), 'directive-avs.pdf');
		expect(fileDownload.openOrDownloadBlob).toHaveBeenCalledWith(expect.any(Blob), 'directive-avs.pdf');
		expect(jest.mocked(fileDownload.downloadBlob).mock.calls[0][0].type).toBe('application/pdf');
	});

	it('signale un PDF qui ne peut pas être chargé et garde l’extrait', async () => {
		sourceService.getView.mockReturnValue(of(view()));
		sourceService.getFile.mockReturnValue(throwError(() => new HttpErrorResponse({status: 500})));
		store.open(aSource({documentId: 'chunk-1'}));
		await settle();

		expect(text()).toContain('sourceViewer.pdf.error');
		expect(pdfViewer()).toBeUndefined();
		expect(query('.viewer-excerpt')).not.toBeNull();
	});

	it('propose le téléchargement d’un fichier non PDF, avec l’extrait affiché', async () => {
		sourceService.getView.mockReturnValue(of(view({display: 'DOWNLOAD', title: 'tableau.xlsx', state: 'personal.uploads', excerptTruncated: true})));
		store.open(aSource({documentId: 'chunk-1'}));
		await settle();

		expect(sourceService.getFile).not.toHaveBeenCalled();
		expect(query('.viewer-excerpt-section blockquote')).not.toBeNull();
		expect(text()).toContain('sourceViewer.excerptTruncated');
		expect(text()).toContain('sourceViewer.state.personalUploads');

		query<HTMLButtonElement>('.viewer-download')?.click();

		expect(sourceService.getFile).toHaveBeenCalledWith('chunk-1');
		expect(fileDownload.downloadBlob).toHaveBeenCalledWith(expect.any(Blob), 'tableau.xlsx');
	});

	it('notifie un téléchargement en échec', async () => {
		sourceService.getView.mockReturnValue(of(view({display: 'DOWNLOAD', title: 'tableau.xlsx'})));
		sourceService.getFile.mockReturnValue(throwError(() => new HttpErrorResponse({status: 500})));
		store.open(aSource({documentId: 'chunk-1'}));
		await settle();

		query<HTMLButtonElement>('.viewer-download')?.click();

		expect(notifications.error).toHaveBeenCalledWith('sourceViewer.downloadError');
		expect(fixture.componentInstance.downloading()).toBe(false);
	});

	it('ouvre la page d’origine d’une source URL, à la page citée pour un PDF', async () => {
		sourceService.getView.mockReturnValue(of(view({display: 'URL', url: 'https://www.ahv-iv.ch/p/2.01.f.pdf', pageNumber: '4', title: undefined})));
		store.open(aSource({documentId: 'chunk-2', type: 'URL', link: 'https://www.ahv-iv.ch/p/2.01.f.pdf'}));
		await settle();

		const link = query<HTMLAnchorElement>('.viewer-open-original');
		expect(link?.href).toBe('https://www.ahv-iv.ch/p/2.01.f.pdf#page=4');
		expect(link?.target).toBe('_blank');
		expect(link?.rel).toBe('noopener noreferrer');
		expect(query('#source-viewer-title')?.textContent).toContain('2.01.f.pdf');
		expect(sourceService.getFile).not.toHaveBeenCalled();
	});

	it('propose le lien BPanda d’un processus métier', async () => {
		sourceService.getView.mockReturnValue(
			of(view({origin: 'BUSINESS_PROCESS', display: 'PROCESS', url: 'https://bpanda.example/p/1', title: 'Affiliation', excerpt: undefined}))
		);
		store.open(aSource({documentId: 'process-1', type: 'BUSINESS_PROCESS'}));
		await settle();

		expect(query<HTMLAnchorElement>('.viewer-open-process')?.href).toBe('https://bpanda.example/p/1');
		expect(query('.viewer-excerpt')).toBeNull();
	});

	it('indique quand seul l’extrait est disponible', async () => {
		sourceService.getView.mockReturnValue(of(view({display: 'EXCERPT', fileAvailable: false})));
		store.open(aSource({documentId: 'chunk-1'}));
		await settle();

		expect(text()).toContain('sourceViewer.fileUnavailable');
		expect(query('.viewer-actions button')).toBeNull();
		expect(query('.viewer-excerpt-section')).not.toBeNull();
	});

	it('affiche le chargement, puis « source introuvable » sur une 404', async () => {
		const view$ = new Subject<SourceView>();
		sourceService.getView.mockReturnValue(view$);
		store.open(aSource({documentId: 'chunk-1'}));
		await settle();
		expect(text()).toContain('sourceViewer.loading');

		view$.error(new HttpErrorResponse({status: 404}));
		await settle();

		expect(text()).toContain('sourceViewer.notFound');
		expect(query('.viewer-retry')).toBeNull();
	});

	it('propose de réessayer après une erreur', async () => {
		sourceService.getView.mockReturnValueOnce(throwError(() => new HttpErrorResponse({status: 503}))).mockReturnValueOnce(of(view({display: 'EXCERPT'})));
		store.open(aSource({documentId: 'chunk-1'}));
		await settle();
		expect(text()).toContain('sourceViewer.error');

		query<HTMLButtonElement>('.viewer-retry')?.click();
		await settle();

		expect(sourceService.getView).toHaveBeenCalledTimes(2);
		expect(text()).toContain('sourceViewer.fileUnavailable');
	});

	it('navigue entre les sources de la réponse', async () => {
		const first = aSource({documentId: 'chunk-1', citation: 1});
		const second = aSource({documentId: 'chunk-2', citation: 2});
		sourceService.getView.mockImplementation((id: string) => of(view({id, display: 'EXCERPT', title: `${id}.pdf`})));
		store.open(first, [first, second]);
		await settle();

		expect(query('.viewer-position')?.textContent?.trim()).toBe('1 / 2');
		expect(query<HTMLButtonElement>('.viewer-previous')?.disabled).toBe(true);

		query<HTMLButtonElement>('.viewer-next')?.click();
		await settle();

		expect(sourceService.getView).toHaveBeenLastCalledWith('chunk-2');
		expect(query('#source-viewer-title')?.textContent).toContain('chunk-2.pdf');
		expect(query<HTMLButtonElement>('.viewer-next')?.disabled).toBe(true);
	});

	it('se ferme par le bouton ou Échap, sans propager Échap à la page', async () => {
		sourceService.getView.mockReturnValue(of(view({display: 'EXCERPT'})));
		store.open(aSource({documentId: 'chunk-1'}));
		await settle();

		const escape = new KeyboardEvent('keydown', {key: 'Escape', bubbles: true});
		const stop = jest.spyOn(escape, 'stopPropagation');
		element().dispatchEvent(escape);
		expect(stop).toHaveBeenCalled();
		expect(store.isOpen()).toBe(false);

		store.open(aSource({documentId: 'chunk-1'}));
		await settle();
		query<HTMLButtonElement>('.viewer-close')?.click();
		expect(store.isOpen()).toBe(false);
	});

	it('affiche un PDF du corpus chargé par le déclencheur', async () => {
		const load = jest.fn((): Observable<Blob> => of(fileBlob('%PDF-1.4')));
		store.openFile('Note.PDF', load);
		await settle();

		expect(load).toHaveBeenCalledTimes(1);
		expect(sourceService.getView).not.toHaveBeenCalled();
		expect(query('#source-viewer-title')?.textContent).toContain('Note.PDF');
		expect(query('.viewer-citation')).toBeNull();
		expect(pdfViewer()?.page()).toBe(1);
		expect(pdfViewer()?.highlight()).toBeUndefined();
	});

	it('télécharge un document du corpus non PDF par le déclencheur', async () => {
		const load = jest.fn((): Observable<Blob> => of(fileBlob('PK')));
		store.openFile('memo.docx', load);
		await settle();
		expect(load).not.toHaveBeenCalled();

		query<HTMLButtonElement>('.viewer-download')?.click();

		expect(load).toHaveBeenCalledTimes(1);
		expect(fileDownload.downloadBlob).toHaveBeenCalledWith(expect.any(Blob), 'memo.docx');
	});

	it('abandonne un nouvel essai quand une autre source est ouverte entre-temps', async () => {
		const lateRetry = new Subject<SourceView>();
		sourceService.getView
			.mockReturnValueOnce(throwError(() => new HttpErrorResponse({status: 503})))
			.mockReturnValueOnce(lateRetry)
			.mockReturnValueOnce(of(view({id: 'chunk-2', display: 'EXCERPT', title: 'b.pdf'})));
		store.open(aSource({documentId: 'chunk-1'}));
		await settle();
		query<HTMLButtonElement>('.viewer-retry')?.click();

		store.open(aSource({documentId: 'chunk-2'}));
		await settle();
		lateRetry.next(view({display: 'EXCERPT', title: 'a.pdf'}));
		await settle();

		expect(lateRetry.observed).toBe(false);
		expect(query('#source-viewer-title')?.textContent).toContain('b.pdf');
	});

	it('propose de réessayer le chargement du PDF', async () => {
		sourceService.getView.mockReturnValue(of(view()));
		sourceService.getFile.mockReturnValueOnce(throwError(() => new HttpErrorResponse({status: 503})));
		store.open(aSource({documentId: 'chunk-1'}));
		await settle();
		expect(text()).toContain('sourceViewer.pdf.error');

		query<HTMLButtonElement>('.viewer-retry')?.click();
		await settle();

		expect(sourceService.getFile).toHaveBeenCalledTimes(2);
		expect(pdfViewer()).toBeDefined();
	});

	it('confine le focus au panneau seulement en surcouche', async () => {
		sourceService.getView.mockReturnValue(of(view({display: 'EXCERPT'})));
		store.open(aSource({documentId: 'chunk-1'}));
		await settle();
		const anchors = (): number => fixture.debugElement.parent?.nativeElement.querySelectorAll('.cdk-focus-trap-anchor[tabindex="0"]').length ?? 0;
		expect(anchors()).toBe(0);

		fixture.componentRef.setInput('overlay', true);
		await settle();

		expect(anchors()).toBe(2);
	});
});
describe('parsePage', () => {
	it.each([
		[undefined, 1],
		['', 1],
		['12', 12],
		['p. 7-9', 7],
		['0', 1],
		['iv', 1]
	])('%p → %p', (input, expected) => expect(parsePage(input)).toBe(expected));
});

describe('withPdfPage', () => {
	it.each([
		[undefined, '3', undefined],
		['https://example.ch/doc.pdf', '3', 'https://example.ch/doc.pdf#page=3'],
		['https://example.ch/doc.PDF?x=1', '2-4', 'https://example.ch/doc.PDF?x=1#page=2'],
		['https://example.ch/doc.pdf#section', '3', 'https://example.ch/doc.pdf#section'],
		['https://example.ch/page.html', '3', 'https://example.ch/page.html'],
		['https://example.ch/doc.pdf', undefined, 'https://example.ch/doc.pdf'],
		['pas une url', '3', 'pas une url']
	])('%p (page %p) → %p', (url, page, expected) => expect(withPdfPage(url, page)).toBe(expected));
});
