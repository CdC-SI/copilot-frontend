import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {provideHttpClient} from '@angular/common/http';
import {TestBed} from '@angular/core/testing';
import {NavigationEnd, Router} from '@angular/router';
import {ObHttpApiInterceptorConfig, ObMasterLayoutConfig, WINDOW} from '@oblique/oblique';
import {EnvironmentService} from '@zas-design-system/zas-design-system';
import {EMPTY, Subject, of, throwError} from 'rxjs';
import {AuthenticationServiceV2} from '../../shared/services/auth.service';
import {Configuration, ZCO_CONFIGURATIONS_TOKEN} from './configuration';
import {ConfigurationService} from './configuration.service';

const CONFIGURATIONS = [
	{patterns: ['localhost'], local: true, production: false, apiUrl: '/local/api'},
	{patterns: ['zia\\.admin'], local: false, production: true, apiUrl: '/zia/api'}
] as Configuration[];

describe('ConfigurationService', () => {
	let service: ConfigurationService;
	let http: HttpTestingController;
	let fakeWindow: {location: {href: string}};
	let routerEvents: Subject<unknown>;
	let layout: {homePageRoute?: string; header: {serviceNavigation: Record<string, unknown>}};
	let interceptorConfig: {api: {spinner: boolean; notification: {active: boolean}}};
	let auth: {jwtToken: string; login: jest.Mock; getFullToken: jest.Mock; $authenticatedUser: Subject<unknown>};
	let environment: {setEnvironmentConfigs: jest.Mock; setMockToken: jest.Mock; isLocalhostEnvironment: jest.Mock; load: jest.Mock};

	beforeEach(() => {
		fakeWindow = {location: {href: 'http://localhost:4200/chat'}};
		routerEvents = new Subject();
		layout = {header: {serviceNavigation: {}}};
		interceptorConfig = {api: {spinner: true, notification: {active: true}}};
		auth = {jwtToken: null, login: jest.fn(), getFullToken: jest.fn(() => of('jwt')), $authenticatedUser: new Subject()};
		environment = {
			setEnvironmentConfigs: jest.fn(),
			setMockToken: jest.fn(),
			isLocalhostEnvironment: jest.fn(),
			load: jest.fn(() => of({gatewayUrl: 'http://gw'}))
		};
		TestBed.configureTestingModule({
			providers: [
				provideHttpClient(),
				provideHttpClientTesting(),
				{provide: ZCO_CONFIGURATIONS_TOKEN, useValue: CONFIGURATIONS},
				{provide: WINDOW, useValue: fakeWindow},
				{provide: ObMasterLayoutConfig, useValue: layout},
				{provide: Router, useValue: {events: routerEvents}},
				{provide: ObHttpApiInterceptorConfig, useValue: interceptorConfig},
				{provide: AuthenticationServiceV2, useValue: auth},
				{provide: EnvironmentService, useValue: environment}
			]
		});
		service = TestBed.inject(ConfigurationService);
		http = TestBed.inject(HttpTestingController);
	});

	afterEach(() => http.verify());

	it('retient la configuration de l’environnement d’après l’URL', () => {
		service.loadConfigurationForEnv();

		expect(service.getEnvConfiguration()).toBe(CONFIGURATIONS[0]);
		expect(service.backendApi('/users')).toBe('/local/api/users');
	});

	it('refuse un environnement inconnu', () => {
		fakeWindow.location.href = 'https://inconnu.test';

		expect(() => service.loadConfigurationForEnv()).toThrow('Environnement non trouvé pour https://inconnu.test!');
	});

	it('configure la mise en page et suit l’URL de retour à chaque navigation', () => {
		service.configureMasterLayout();

		expect(layout.homePageRoute).toBe('/chat');
		expect(layout.header.serviceNavigation).toEqual(
			expect.objectContaining({returnUrl: 'http://localhost:4200/chat', displayLanguages: true, displayAuthentication: false})
		);

		fakeWindow.location.href = 'http://localhost:4200/corpus';
		routerEvents.next({});
		expect(layout.header.serviceNavigation['returnUrl']).toBe('http://localhost:4200/chat');
		routerEvents.next(new NavigationEnd(1, '/corpus', '/corpus'));
		expect(layout.header.serviceNavigation['returnUrl']).toBe('http://localhost:4200/corpus');
	});

	it('en local : jeton simulé et utilisateur chargé sans passer par la gateway', async () => {
		const user = {username: 'u1'};
		const users: unknown[] = [];
		auth.$authenticatedUser.subscribe(value => users.push(value));

		const ready = service.preInitialize();
		http.expectOne('/local/api/users/authenticated').flush(user);
		await ready;

		expect(interceptorConfig.api).toEqual({spinner: false, notification: {active: false}});
		expect(environment.setEnvironmentConfigs).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({gatewayUrl: 'http://localhost:9998'})]));
		expect(environment.isLocalhostEnvironment).toHaveBeenCalledWith(true);
		expect(environment.setMockToken).toHaveBeenCalled();
		expect(auth.login).not.toHaveBeenCalled();
		expect(users).toEqual([user]);
	});

	it('hors local : authentification par la gateway puis chargement de l’utilisateur', async () => {
		fakeWindow.location.href = 'https://zia.admin.ch/chat';

		const ready = service.preInitialize();
		http.expectOne('/zia/api/users/authenticated').flush({username: 'u1'});
		await ready;

		expect(auth.login).toHaveBeenCalled();
		expect(auth.getFullToken).toHaveBeenCalled();
	});

	it('n’interrompt pas le démarrage si l’authentification échoue', async () => {
		jest.spyOn(console, 'error').mockImplementation(() => undefined);
		environment.load.mockReturnValue(throwError(() => new Error('KO')));
		service.loadConfigurationForEnv();

		await expect(service.configureAuthentication()).resolves.toBeUndefined();
		expect(console.error).toHaveBeenCalled();
	});

	it('n’attend pas l’utilisateur sans jeton complet', async () => {
		jest.spyOn(console, 'error').mockImplementation(() => undefined);
		fakeWindow.location.href = 'https://zia.admin.ch/chat';
		auth.getFullToken.mockReturnValue(EMPTY);

		await service.preInitialize();

		expect(console.error).toHaveBeenCalled();
	});
});
