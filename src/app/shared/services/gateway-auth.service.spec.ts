import {TestBed} from '@angular/core/testing';
import {MatDialog} from '@angular/material/dialog';
import {AuthenticationDialogComponent, EnvironmentService} from '@zas-design-system/zas-design-system';
import {of} from 'rxjs';
import {AuthenticationServiceV2} from './auth.service';
import {GatewayAuthService} from './gateway-auth.service';

describe('GatewayAuthService', () => {
	let service: GatewayAuthService;
	let auth: {jwtToken: string | null; isConnected: jest.Mock};
	let environment: {getIsLocalhostEnvironment: jest.Mock; getMockToken: jest.Mock};
	let dialog: {getDialogById: jest.Mock; open: jest.Mock};

	beforeEach(() => {
		auth = {jwtToken: 'jwt', isConnected: jest.fn(() => true)};
		environment = {getIsLocalhostEnvironment: jest.fn(() => false), getMockToken: jest.fn(() => 'mock')};
		dialog = {getDialogById: jest.fn((): unknown => undefined), open: jest.fn(() => ({afterClosed: () => of(undefined)}))};
		TestBed.configureTestingModule({
			providers: [
				{provide: AuthenticationServiceV2, useValue: auth},
				{provide: EnvironmentService, useValue: environment},
				{provide: MatDialog, useValue: dialog}
			]
		});
		service = TestBed.inject(GatewayAuthService);
	});

	describe('en-têtes', () => {
		it('portent le jeton de l’utilisateur et un identifiant de corrélation unique', () => {
			const first = service.requestHeaders();
			const second = service.requestHeaders();

			expect(first[GatewayAuthService.TOKEN_HEADER]).toBe('Bearer jwt');
			expect(first[GatewayAuthService.CORRELATION_HEADER]).toMatch(/^.{21}$/);
			expect(second[GatewayAuthService.CORRELATION_HEADER]).not.toBe(first[GatewayAuthService.CORRELATION_HEADER]);
		});

		it('portent le jeton simulé en local', () => {
			environment.getIsLocalhostEnvironment.mockReturnValue(true);

			expect(service.isLocalhost()).toBe(true);
			expect(service.requestHeaders()[GatewayAuthService.TOKEN_HEADER]).toBe('Bearer mock');
		});
	});

	describe('session', () => {
		it('reste silencieuse tant que la session est ouverte', () => {
			service.checkSession();

			expect(dialog.open).not.toHaveBeenCalled();
		});

		it('ouvre le dialogue d’expiration après une déconnexion dans un autre onglet', () => {
			auth.isConnected.mockReturnValue(false);

			service.checkSession();

			expect(dialog.open).toHaveBeenCalledWith(
				AuthenticationDialogComponent,
				expect.objectContaining({id: 'unauthorized', disableClose: true, data: {unauthorized: true, header: 'i18n.authentication.expired'}})
			);
		});

		it('ignore l’indicateur de déconnexion avant toute authentification', () => {
			auth.jwtToken = null;
			auth.isConnected.mockReturnValue(false);

			service.checkSession();

			expect(dialog.open).not.toHaveBeenCalled();
		});

		it('n’ouvre pas deux fois le dialogue d’expiration', () => {
			dialog.getDialogById.mockReturnValue({});

			service.displayUnauthorized();

			expect(dialog.open).not.toHaveBeenCalled();
		});
	});

	describe('rafraîchissement du jeton', () => {
		it('adopte le jeton renvoyé par la gateway', () => {
			service.refreshToken({get: name => (name === 'blue' ? 'nouveau' : null)});

			expect(auth.jwtToken).toBe('nouveau');
		});

		it('garde le jeton courant sans en-tête', () => {
			service.refreshToken({get: () => null});

			expect(auth.jwtToken).toBe('jwt');
		});
	});
});
