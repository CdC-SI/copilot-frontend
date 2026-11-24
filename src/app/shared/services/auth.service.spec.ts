import {HttpTestingController} from '@angular/common/http/testing';
import {LocationStrategy} from '@angular/common';
import {TestBed} from '@angular/core/testing';
import {WINDOW} from '@oblique/oblique';
import {EnvironmentService, LocalStorageService} from '@zas-design-system/zas-design-system';
import {NotificationMock, notificationMock, provideApiTesting, provideNotificationMock} from '../../../testing/angular';
import {aUser} from '../../../testing/fixtures';
import {Role, UserStatus} from '../model/user';
import {AuthenticationServiceV2, cleanUri} from './auth.service';

const GATEWAY = 'https://gateway.test';
const FULLTOKEN_URL = `${GATEWAY}/v2/fulltoken?filtering=ADMIN&filtering=EXPERT&filtering=TRANSLATOR`;

describe('AuthenticationServiceV2', () => {
	let service: AuthenticationServiceV2;
	let http: HttpTestingController;
	let notif: NotificationMock;
	let storage: Map<string, string>;
	let fakeWindow: {
		location: {search: string; href: string; origin: string; replace: jest.Mock; toString: () => string};
		history: {replaceState: jest.Mock};
		localStorage: Pick<Storage, 'getItem' | 'setItem'>;
	};

	beforeEach(() => {
		notif = notificationMock();
		storage = new Map();
		const href = 'https://zia.test/chat?ACCESS_TOKEN=abc';
		fakeWindow = {
			location: {search: '?ACCESS_TOKEN=abc', href, origin: 'https://zia.test', replace: jest.fn(), toString: () => href},
			history: {replaceState: jest.fn()},
			localStorage: {getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value)}
		};
		TestBed.configureTestingModule({
			providers: [
				...provideApiTesting(),
				provideNotificationMock(notif),
				{provide: WINDOW, useValue: fakeWindow},
				{provide: LocalStorageService, useValue: {initData: jest.fn()}},
				{provide: LocationStrategy, useValue: {getBaseHref: () => '/zia/'}},
				{provide: EnvironmentService, useValue: {current: {gatewayUrl: GATEWAY}}}
			]
		});
		service = TestBed.inject(AuthenticationServiceV2);
		http = TestBed.inject(HttpTestingController);
	});

	afterEach(() => http.verify());

	describe('connexion', () => {
		it('ne redirige pas quand l’URL porte déjà un jeton', () => {
			service.login();

			expect(fakeWindow.location.replace).not.toHaveBeenCalled();
		});

		it('redirige vers l’authentification de la gateway sans jeton', () => {
			fakeWindow.location.search = '';

			service.login();

			expect(fakeWindow.location.replace).toHaveBeenCalledWith(`${GATEWAY}/v2/authenticate-eiam?redirect=https://zia.test/chat?ACCESS_TOKEN=abc`);
		});
	});

	describe('déconnexion', () => {
		it('oublie le jeton, signale la déconnexion aux autres onglets et redirige vers la racine', () => {
			service.jwtToken = 'jwt';

			service.logout();

			expect(service.jwtToken).toBeNull();
			expect(service.isConnected()).toBe(false);
			expect(fakeWindow.location.replace).toHaveBeenCalledWith(`${GATEWAY}/v2/logout?redirect=https://zia.test/zia/`);
		});

		it('redirige vers l’adresse demandée', () => {
			service.logout('https://ailleurs.test');

			expect(fakeWindow.location.replace).toHaveBeenCalledWith(`${GATEWAY}/v2/logout?redirect=https://ailleurs.test`);
		});
	});

	it('se considère connecté tant qu’aucune déconnexion n’a été signalée', () => {
		expect(service.isConnected()).toBe(true);
	});

	describe('jeton complet', () => {
		it('mémorise le jeton, marque la session connectée et nettoie l’URL', () => {
			let token: string | undefined;
			storage.set('zia-connected', 'false');

			service.getFullToken().subscribe(value => (token = value));
			const request = http.expectOne(FULLTOKEN_URL);
			expect(request.request.withCredentials).toBe(true);
			request.flush('jwt-complet');

			expect(token).toBe('jwt-complet');
			expect(service.jwtToken).toBe('jwt-complet');
			expect(service.isConnected()).toBe(true);
			expect(fakeWindow.history.replaceState).toHaveBeenCalledWith({}, expect.any(String), 'https://zia.test/chat');
		});

		it('ne touche pas à l’historique quand l’URL n’a pas de paramètres', () => {
			fakeWindow.location.toString = () => 'https://zia.test/chat';

			service.getFullToken().subscribe();
			http.expectOne(FULLTOKEN_URL).flush('jwt');

			expect(fakeWindow.history.replaceState).not.toHaveBeenCalled();
		});

		it.each([
			[401, 'i18n.authentication.silent-auth.fail'],
			[500, 'i18n.oblique.http.error.general']
		])('notifie un échec HTTP %s et termine sans valeur', (status, message) => {
			const next = jest.fn();
			const complete = jest.fn();

			service.getFullToken().subscribe({next, complete});
			http.expectOne(FULLTOKEN_URL).flush(null, {status, statusText: 'KO'});

			expect(notif.error).toHaveBeenCalledWith(message);
			expect(next).not.toHaveBeenCalled();
			expect(complete).toHaveBeenCalled();
		});

		it('notifie une erreur réseau', () => {
			service.getFullToken().subscribe();
			http.expectOne(FULLTOKEN_URL).error(new ProgressEvent('error'));

			expect(notif.error).toHaveBeenCalledWith('i18n.oblique.http.error.general');
		});
	});

	describe('rôles et profil', () => {
		it('ne donne aucun droit sans utilisateur', () => {
			expect(service.hasAdminRole()).toBeUndefined();
			expect(service.hasExpertRole()).toBeFalsy();
			expect(service.hasTranslatorRole()).toBeFalsy();
			expect(service.isRegistered()).toBe(false);
			expect(service.userStatus()).toBeNull();
			expect(service.displayName()).toBe('');
			expect(service.username()).toBe('');
		});

		it('accorde tous les rôles à un administrateur', () => {
			service.$authenticatedUser.next(aUser({roles: [Role.ADMIN]}));

			expect(service.hasAdminRole()).toBe(true);
			expect(service.hasExpertRole()).toBe(true);
			expect(service.hasTranslatorRole()).toBe(true);
		});

		it('distingue expert et traducteur', () => {
			service.$authenticatedUser.next(aUser({roles: [Role.EXPERT]}));
			expect(service.hasExpertRole()).toBe(true);
			expect(service.hasTranslatorRole()).toBe(false);

			service.$authenticatedUser.next(aUser({roles: [Role.TRANSLATOR]}));
			expect(service.hasExpertRole()).toBe(false);
			expect(service.hasTranslatorRole()).toBe(true);
		});

		it('expose le statut, le nom affiché et l’identifiant', () => {
			service.$authenticatedUser.next(aUser({status: UserStatus.ACTIVE}));

			expect(service.isRegistered()).toBe(true);
			expect(service.userStatus()).toBe(UserStatus.ACTIVE);
			expect(service.displayName()).toBe('Ada Lovelace');
			expect(service.username()).toBe('u12345');
		});

		it('n’affiche pas de nom incomplet', () => {
			service.$authenticatedUser.next(aUser({lastName: undefined, status: UserStatus.PENDING_ACTIVATION}));

			expect(service.displayName()).toBe('');
			expect(service.isRegistered()).toBe(false);
		});
	});
});

describe('cleanUri', () => {
	it.each([
		['https://zia.test/chat?ACCESS_TOKEN=abc', 'https://zia.test/chat'],
		['https://zia.test/chat', 'https://zia.test/chat'],
		['?seul', '?seul'],
		['', '']
	])('%s → %s', (uri, expected) => {
		expect(cleanUri(uri)).toBe(expected);
	});
});
