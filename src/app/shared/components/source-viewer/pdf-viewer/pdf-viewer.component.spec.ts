import {Component, input} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {MatIcon} from '@angular/material/icon';
import {provideTranslateService} from '@ngx-translate/core';
import type {PDFDocumentProxy, PDFPageProxy} from 'pdfjs-dist';
import {PdfJsService, PdfLoadingTask, TextLayerTask} from './pdf-js.service';
import {PdfViewerComponent} from './pdf-viewer.component';

@Component({selector: 'mat-icon', template: ''})
class MatIconStubComponent {
	readonly svgIcon = input<string>();
}

class Cancellation extends Error {
	override readonly name = 'RenderingCancelledException';
}

/** Textes de chaque page du document factice (une entrée par élément de la couche texte). */
const PAGES: string[][] = [['Introduction générale'], ['Chapitre 2', 'Les cotisations sont dues', 'dès 18 ans révolus.', 'Autre paragraphe'], ['Annexe']];

describe('PdfViewerComponent', () => {
	let fixture: ComponentFixture<PdfViewerComponent>;
	let component: PdfViewerComponent;
	let pdfJs: {open: jest.Mock; renderTextLayer: jest.Mock; isCancellation: (error: unknown) => boolean};
	let destroy: jest.Mock;
	let render: jest.Mock;
	let getPage: jest.Mock;
	const element = (): HTMLElement => fixture.nativeElement;
	const query = <T extends Element = HTMLElement>(selector: string): T | null => element().querySelector<T>(selector);
	const buttons = (): HTMLButtonElement[] => Array.from(element().querySelectorAll<HTMLButtonElement>('.pdf-toolbar button'));
	const highlighted = (): string[] => Array.from(element().querySelectorAll('.textLayer .highlight')).map(div => div.textContent ?? '');

	const settle = async (): Promise<void> => {
		fixture.detectChanges();
		await fixture.whenStable();
		for (let i = 0; i < 5; i++) await Promise.resolve();
		await new Promise(resolve => setTimeout(resolve));
		fixture.detectChanges();
	};

	const fakePage = (): PDFPageProxy =>
		({
			getViewport: ({scale}: {scale: number}) => ({width: 600 * scale, height: 800 * scale}),
			render
		}) as unknown as PDFPageProxy;

	const fakeDocument = (): PDFDocumentProxy =>
		({
			numPages: PAGES.length,
			getPage
		}) as unknown as PDFDocumentProxy;

	/** Ouverture simulée : `destroy` est partagé par toutes les tâches (comptage des libérations). */
	const task = (promise: Promise<PDFDocumentProxy>): PdfLoadingTask => ({promise, destroy});

	const create = async (inputs: {page?: number; highlight?: string} = {}): Promise<void> => {
		fixture = TestBed.createComponent(PdfViewerComponent);
		component = fixture.componentInstance;
		fixture.componentRef.setInput('data', new Uint8Array([1, 2, 3]));
		if (inputs.page !== undefined) fixture.componentRef.setInput('page', inputs.page);
		if (inputs.highlight !== undefined) fixture.componentRef.setInput('highlight', inputs.highlight);
		await settle();
	};

	beforeEach(() => {
		destroy = jest.fn(async () => Promise.resolve());
		render = jest.fn(() => ({promise: Promise.resolve(), cancel: jest.fn()}));
		getPage = jest.fn<Promise<PDFPageProxy>, [number]>(async () => Promise.resolve(fakePage()));
		pdfJs = {
			open: jest.fn(() => task(Promise.resolve(fakeDocument()))),
			renderTextLayer: jest.fn((page: PDFPageProxy, container: HTMLElement): TextLayerTask => {
				const index = getPage.mock.results.length - 1;
				const pageNumber = getPage.mock.calls[index][0] as number;
				const divs = PAGES[pageNumber - 1].map(text => {
					const div = document.createElement('span');
					div.textContent = text;
					container.appendChild(div);
					return div;
				});
				return {promise: Promise.resolve(divs), cancel: jest.fn()};
			}),
			isCancellation: (error: unknown) => error instanceof Cancellation
		};
		TestBed.configureTestingModule({
			imports: [PdfViewerComponent],
			providers: [provideTranslateService(), {provide: PdfJsService, useValue: pdfJs}]
		});
		TestBed.overrideComponent(PdfViewerComponent, {remove: {imports: [MatIcon]}, add: {imports: [MatIconStubComponent]}});
	});

	afterEach(() => fixture?.destroy());

	it('ouvre une copie des données à la page demandée et surligne le passage cité', async () => {
		await create({page: 2, highlight: 'Les cotisations sont dues dès 18 ans révolus.'});

		const data = pdfJs.open.mock.calls[0][0] as Uint8Array;
		expect(Array.from(data)).toEqual([1, 2, 3]);
		expect(data).not.toBe(fixture.componentInstance.data());
		expect(component.status()).toBe('ready');
		expect(component.pageCount()).toBe(3);
		expect(component.currentPage()).toBe(2);
		expect(getPage).toHaveBeenCalledWith(2);
		expect(render).toHaveBeenCalledWith(expect.objectContaining({canvas: query('canvas')}));
		expect(highlighted()).toEqual(['Les cotisations sont dues', 'dès 18 ans révolus.']);
		expect(component.passageFound()).toBe(true);
		expect(query('.pdf-page-number')?.textContent?.trim()).toBe('sourceViewer.pdf.page');
		expect(query('.pdf-status')).toBeNull();
	});

	it('signale un passage introuvable sur la page affichée', async () => {
		await create({page: 1, highlight: 'Les cotisations sont dues dès 18 ans révolus.'});

		expect(highlighted()).toEqual([]);
		expect(component.passageFound()).toBe(false);
		expect(query('.pdf-status.hint')?.textContent).toContain('sourceViewer.pdf.notHighlighted');
	});

	it('ne cherche aucun passage sans extrait et borne la page demandée au document', async () => {
		await create({page: 99});

		expect(component.currentPage()).toBe(3);
		expect(component.passageFound()).toBeNull();
		expect(query('.pdf-status')).toBeNull();
	});

	it('navigue entre les pages dans les limites du document', async () => {
		await create({page: 1});
		const [previous, next] = buttons();
		expect(previous.disabled).toBe(true);

		next.click();
		await settle();
		expect(component.currentPage()).toBe(2);
		expect(getPage).toHaveBeenLastCalledWith(2);
		expect(query('.textLayer')?.textContent).toContain('Chapitre 2');

		component.nextPage();
		await settle();
		expect(component.currentPage()).toBe(3);
		expect(buttons()[1].disabled).toBe(true);
		component.nextPage();
		expect(component.currentPage()).toBe(3);

		buttons()[0].click();
		await settle();
		expect(component.currentPage()).toBe(2);
	});

	it('zoome entre 50 % et 300 % par pas de 25 %', async () => {
		await create();
		const renders = render.mock.calls.length;

		component.zoomIn();
		await settle();
		expect(component.zoom()).toBe(1.25);
		expect(render.mock.calls.length).toBe(renders + 1);

		for (let i = 0; i < 10; i++) component.zoomIn();
		expect(component.zoom()).toBe(3);
		expect(component.canZoomIn).toBe(false);

		for (let i = 0; i < 20; i++) component.zoomOut();
		expect(component.zoom()).toBe(0.5);
		expect(component.canZoomOut).toBe(false);
		await settle();
		expect(buttons()[2].disabled).toBe(true);
	});

	it('affiche une erreur si le PDF ne peut pas être ouvert', async () => {
		pdfJs.open.mockReturnValue(task(Promise.reject(new Error('Invalid PDF structure'))));
		await create();

		expect(destroy).toHaveBeenCalledTimes(1);

		expect(component.status()).toBe('error');
		expect(query('.pdf-status.error')?.getAttribute('role')).toBe('alert');
		expect(buttons().every(button => button.disabled)).toBe(true);
	});

	it('affiche une erreur si le rendu de la page échoue, mais ignore un rendu annulé', async () => {
		render.mockReturnValueOnce({promise: Promise.reject(new Cancellation()), cancel: jest.fn()});
		await create();
		expect(component.status()).toBe('ready');

		render.mockReturnValueOnce({promise: Promise.reject(new Error('boom')), cancel: jest.fn()});
		component.zoomIn();
		await settle();
		expect(component.status()).toBe('error');
	});

	it('affiche le chargement tant que le document n’est pas ouvert', async () => {
		pdfJs.open.mockReturnValue(task(new Promise(() => undefined)));
		await create();

		expect(component.status()).toBe('loading');
		expect(query('.pdf-status')?.getAttribute('role')).toBe('status');
		expect(query('.pdf-page-view')?.classList).toContain('hidden');
	});

	it('libère le document précédent au changement de données et à la destruction', async () => {
		await create();

		fixture.componentRef.setInput('data', new Uint8Array([4]));
		await settle();
		expect(destroy).toHaveBeenCalledTimes(1);
		expect(pdfJs.open).toHaveBeenCalledTimes(2);

		fixture.destroy();
		expect(destroy).toHaveBeenCalledTimes(2);
	});

	it('abandonne un document ouvert après un changement de données', async () => {
		let resolveFirst: (pdf: PDFDocumentProxy) => void = () => undefined;
		pdfJs.open.mockReturnValueOnce(
			task(
				new Promise<PDFDocumentProxy>(resolve => {
					resolveFirst = resolve;
				})
			)
		);
		await create();

		fixture.componentRef.setInput('data', new Uint8Array([4]));
		await settle();
		resolveFirst(fakeDocument());
		await settle();

		expect(destroy).toHaveBeenCalledTimes(1);
		expect(component.status()).toBe('ready');
		expect(getPage).toHaveBeenCalledTimes(1);
	});

	it('interrompt l’ouverture en cours à la destruction', async () => {
		pdfJs.open.mockReturnValue(task(new Promise(() => undefined)));
		await create();

		fixture.destroy();

		expect(destroy).toHaveBeenCalledTimes(1);
	});

	describe('redimensionnement', () => {
		let resize: () => void = () => undefined;
		const disconnect = jest.fn();

		beforeEach(() => {
			(globalThis as {ResizeObserver?: unknown}).ResizeObserver = class {
				disconnect = disconnect;

				constructor(callback: () => void) {
					resize = callback;
				}
				observe(): void {
					// Le test déclenche le rappel lui-même.
				}
			};
		});

		afterEach(() => delete (globalThis as {ResizeObserver?: unknown}).ResizeObserver);

		it('réajuste la page à la nouvelle largeur du conteneur, et cesse d’observer à la destruction', async () => {
			await create();
			const host = fixture.nativeElement as HTMLElement;
			const renders = render.mock.calls.length;

			resize();
			await settle();
			expect(render.mock.calls.length).toBe(renders);

			Object.defineProperty(host, 'clientWidth', {configurable: true, value: 500});
			resize();
			await settle();
			expect(render.mock.calls.length).toBe(renders + 1);
			expect(query<HTMLElement>('.pdf-page-view')?.style.width).toBe('468px');

			fixture.destroy();
			expect(disconnect).toHaveBeenCalled();
		});
	});
});
