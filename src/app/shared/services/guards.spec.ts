import {TestBed} from '@angular/core/testing';
import {ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter} from '@angular/router';
import {UserStatus} from '../model/user';
import {AdminGuard} from './admin.guard';
import {AuthenticationServiceV2} from './auth.service';
import {UserGuard} from './user.guard';

describe('Guards', () => {
	let auth: {hasAdminRole: jest.Mock; userStatus: jest.Mock};

	beforeEach(() => {
		auth = {hasAdminRole: jest.fn(() => false), userStatus: jest.fn(() => UserStatus.ACTIVE)};
		TestBed.configureTestingModule({providers: [provideRouter([]), {provide: AuthenticationServiceV2, useValue: auth}]});
	});

	const state = (url: string) => ({url}) as RouterStateSnapshot;
	const route = {} as ActivatedRouteSnapshot;
	const urlOf = (result: unknown) => TestBed.inject(Router).serializeUrl(result as UrlTree);

	describe('AdminGuard', () => {
		const run = (url: string) => TestBed.runInInjectionContext(() => AdminGuard(route, state(url)));

		it.each(['/admin/users', '/tips'])('laisse passer un administrateur actif vers %s', url => {
			auth.hasAdminRole.mockReturnValue(true);

			expect(run(url)).toBe(true);
		});

		it('renvoie un non-administrateur vers le chat', () => {
			expect(urlOf(run('/admin'))).toBe('/chat');
		});

		it('renvoie un administrateur non actif vers le chat', () => {
			auth.hasAdminRole.mockReturnValue(true);
			auth.userStatus.mockReturnValue(UserStatus.INACTIVE);

			expect(urlOf(run('/tips'))).toBe('/chat');
		});

		it('ne protège pas les autres pages', () => {
			expect(run('/chat')).toBe(true);
		});
	});

	describe('UserGuard', () => {
		const run = (url: string) => TestBed.runInInjectionContext(() => UserGuard(route, state(url)));

		it('laisse un utilisateur actif accéder à son espace personnel', () => {
			expect(run('/personal/documents')).toBe(true);
		});

		it.each([UserStatus.GUEST, UserStatus.PENDING_ACTIVATION, null])('renvoie un utilisateur %s vers le chat', status => {
			auth.userStatus.mockReturnValue(status);

			expect(urlOf(run('/personal'))).toBe('/chat');
		});

		it('ne protège pas les autres pages', () => {
			auth.userStatus.mockReturnValue(UserStatus.GUEST);

			expect(run('/chat')).toBe(true);
		});
	});
});
