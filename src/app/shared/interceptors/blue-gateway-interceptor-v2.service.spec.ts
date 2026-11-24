import {HTTP_INTERCEPTORS, HttpClient, provideHttpClient, withInterceptorsFromDi} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {TestBed} from '@angular/core/testing';
import {GatewayAuthService} from '../services/gateway-auth.service';
import {BlueGatewayInterceptorV2} from './blue-gateway-interceptor-v2.service';

describe('BlueGatewayInterceptorV2', () => {
	let http: HttpClient;
	let backend: HttpTestingController;
	let gatewayAuth: {isLocalhost: jest.Mock; requestHeaders: jest.Mock; checkSession: jest.Mock; refreshToken: jest.Mock};

	beforeEach(() => {
		gatewayAuth = {
			isLocalhost: jest.fn(() => false),
			requestHeaders: jest.fn(() => ({blue: 'Bearer jwt', 'X-Correlation-Id': 'corr'})),
			checkSession: jest.fn(),
			refreshToken: jest.fn()
		};
		TestBed.configureTestingModule({
			providers: [
				provideHttpClient(withInterceptorsFromDi()),
				provideHttpClientTesting(),
				{provide: HTTP_INTERCEPTORS, useClass: BlueGatewayInterceptorV2, multi: true},
				{provide: GatewayAuthService, useValue: gatewayAuth}
			]
		});
		http = TestBed.inject(HttpClient);
		backend = TestBed.inject(HttpTestingController);
	});

	afterEach(() => backend.verify());

	it('ajoute les en-têtes de la gateway, vérifie la session et reprend le jeton rafraîchi', () => {
		http.get('/api/x').subscribe();

		const request = backend.expectOne('/api/x');
		expect(request.request.headers.get('blue')).toBe('Bearer jwt');
		expect(request.request.headers.get('X-Correlation-Id')).toBe('corr');
		request.flush({}, {headers: {blue: 'nouveau'}});

		expect(gatewayAuth.checkSession).toHaveBeenCalled();
		expect(gatewayAuth.refreshToken).toHaveBeenCalledWith(expect.objectContaining({get: expect.any(Function)}));
		expect(gatewayAuth.refreshToken.mock.calls[0][0].get('blue')).toBe('nouveau');
	});

	it('se contente des en-têtes en local', () => {
		gatewayAuth.isLocalhost.mockReturnValue(true);

		http.get('/api/x').subscribe();
		const request = backend.expectOne('/api/x');
		expect(request.request.headers.get('blue')).toBe('Bearer jwt');
		request.flush({});

		expect(gatewayAuth.checkSession).not.toHaveBeenCalled();
		expect(gatewayAuth.refreshToken).not.toHaveBeenCalled();
	});
});
