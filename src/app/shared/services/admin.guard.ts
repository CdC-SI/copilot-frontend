import {ActivatedRouteSnapshot, CanActivateFn, Router, RouterStateSnapshot, UrlTree} from '@angular/router';
import {Injectable, inject} from '@angular/core';
import {AuthenticationServiceV2} from './auth.service';
import {UserStatus} from '../model/user';

@Injectable({
	providedIn: 'root'
})
class PermissionService {
	constructor(
		private readonly router: Router,
		private readonly authService: AuthenticationServiceV2
	) {}
	canActivate(next: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean | UrlTree {
		if (
			(state.url.startsWith('/admin') || state.url.startsWith('/tips')) &&
			(!this.authService.hasAdminRole() || this.authService.userStatus() !== UserStatus.ACTIVE)
		) {
			return this.router.createUrlTree(['/chat']);
		}

		return true;
	}
}

export const AdminGuard: CanActivateFn = (next: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
	return inject(PermissionService).canActivate(next, state);
};
