import {ActivatedRouteSnapshot, CanActivateFn, Router, RouterStateSnapshot, UrlTree} from '@angular/router';
import {Injectable, inject} from '@angular/core';
import {UserService} from './user.service';

@Injectable({
	providedIn: 'root'
})
class PermissionService {
	constructor(
		private readonly router: Router,
		private readonly userService: UserService
	) {}
	canActivate(next: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean | UrlTree {
		if (state.url === '/admin' && !this.userService.isAuthenticatedAsAdmin()) {
			return this.router.createUrlTree(['/home']);
		}

		return true;
	}
}

export const AdminGuard: CanActivateFn = (next: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
	return inject(PermissionService).canActivate(next, state);
};
