import {PdfJsService} from './pdf-js.service';

describe('PdfJsService', () => {
	let service: PdfJsService;
	let getDocument: jest.Mock;
	let taskDestroy: jest.Mock;
	let resolveModule: (pdfjs: unknown) => void;

	beforeEach(() => {
		service = new PdfJsService();
		taskDestroy = jest.fn(async () => Promise.resolve());
		getDocument = jest.fn(() => ({promise: Promise.resolve('document'), destroy: taskDestroy}));
		const module = new Promise(resolve => {
			resolveModule = resolve;
		});
		// pdf.js est un module ESM chargé à la demande : remplacé ici par un module minimal.
		jest.spyOn(service as unknown as {load: () => Promise<unknown>}, 'load').mockReturnValue(module);
	});

	it('ouvre le document avec les ressources servies par l’application', async () => {
		const data = new Uint8Array([1]);
		const task = service.open(data);
		resolveModule({getDocument});

		await expect(task.promise).resolves.toBe('document');
		expect(getDocument).toHaveBeenCalledWith(
			expect.objectContaining({
				data,
				cMapUrl: expect.stringMatching(/assets\/pdfjs\/cmaps\/$/),
				standardFontDataUrl: expect.stringMatching(/assets\/pdfjs\/standard_fonts\/$/),
				wasmUrl: expect.stringMatching(/assets\/pdfjs\/wasm\/$/),
				iccUrl: expect.stringMatching(/assets\/pdfjs\/iccs\/$/),
				enableXfa: false
			})
		);

		await task.destroy();
		expect(taskDestroy).toHaveBeenCalledTimes(1);
	});

	it('n’ouvre pas le document si la tâche est détruite avant le chargement de pdf.js', async () => {
		const task = service.open(new Uint8Array([1]));
		await task.destroy();
		resolveModule({getDocument});

		await expect(task.promise).rejects.toMatchObject({name: 'AbortException'});
		expect(getDocument).not.toHaveBeenCalled();
		expect(service.isCancellation(await task.promise.catch((error: unknown) => error))).toBe(true);
	});

	it('reconnaît les annulations de rendu de pdf.js', () => {
		expect(service.isCancellation({name: 'RenderingCancelledException'})).toBe(true);
		expect(service.isCancellation(new Error('Invalid PDF'))).toBe(false);
		expect(service.isCancellation(null)).toBe(false);
	});
});
