import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {TestBed} from '@angular/core/testing';
import {ObHttpApiInterceptorEvents} from '@oblique/oblique';
import {ConfigurationService} from '../../core/app-configuration/configuration.service';
import {SourceDocumentService} from './source-document.service';

describe('SourceDocumentService', () => {
	let service: SourceDocumentService;
	let http: HttpTestingController;
	let deactivateNotification: jest.Mock;

	beforeEach(() => {
		deactivateNotification = jest.fn();
		TestBed.configureTestingModule({
			providers: [
				provideHttpClient(),
				provideHttpClientTesting(),
				{provide: ConfigurationService, useValue: {backendApi: (path: string) => `/zia/api${path}`}},
				{provide: ObHttpApiInterceptorEvents, useValue: {deactivateNotificationOnNextAPICalls: deactivateNotification}}
			]
		});
		service = TestBed.inject(SourceDocumentService);
		http = TestBed.inject(HttpTestingController);
	});

	afterEach(() => http.verify());

	it('charge la vue d’une source, sans notification générique en cas d’erreur', () => {
		const view$ = service.getView('chunk/1');
		expect(deactivateNotification).not.toHaveBeenCalled();

		let title: string | undefined;
		view$.subscribe(view => (title = view.title));

		expect(deactivateNotification).toHaveBeenCalledWith(1);
		http.expectOne('/zia/api/source-documents/chunk%2F1').flush({id: 'chunk/1', title: 'Directive AVS'});
		expect(title).toBe('Directive AVS');
	});

	it('charge le fichier d’une source en blob', () => {
		let size: number | undefined;
		service.getFile('chunk-1').subscribe(blob => (size = blob.size));

		const request = http.expectOne('/zia/api/source-documents/chunk-1/file');
		expect(request.request.responseType).toBe('blob');
		request.flush(new Blob(['%PDF-1.7']));
		expect(size).toBe(8);
		expect(deactivateNotification).toHaveBeenCalledTimes(1);
	});
});
