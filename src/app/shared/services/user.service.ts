import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {ConfigurationService} from '../../core/app-configuration/configuration.service';
import {Observable} from 'rxjs';
import {IUser} from '../model/user';
import {AuthenticationServiceV2} from './auth.service';
import {IPage} from '../model/page';

export interface UserRegistrationResponse {
	userId: string;
}

@Injectable({
	providedIn: 'root'
})
export class UserService {
	constructor(
		private readonly http: HttpClient,
		private readonly config: ConfigurationService,
		private readonly authService: AuthenticationServiceV2
	) {}

	createAccount(user: IUser): Observable<UserRegistrationResponse> {
		return this.http.post<UserRegistrationResponse>(this.config.backendApi('/users'), user);
	}

	refreshAuthenticatedUser() {
		this.http.get<IUser>(this.config.backendApi('/users/authenticated')).subscribe({
			next: user => {
				this.authService.$authenticatedUser.next(user);
			}
		});
	}

	getUsers(page: number, pageSize: number, sortField: string, sortDirection: 'asc' | 'desc') {
		return this.http.get<IPage<IUser>>(this.config.backendApi('/users'), {
			params: {
				page,
				pageSize,
				sortField,
				sortDirection: sortDirection.toUpperCase()
			}
		});
	}

	validate(user: IUser) {
		return this.http.put<void>(this.config.backendApi(`/users/${user.username}/validate`), user);
	}

	reactivateUser(user: IUser) {
		return this.http.put<void>(this.config.backendApi(`/users/${user.username}/reactivate`), user);
	}

	deactivateUser(user: IUser) {
		return this.http.put<void>(this.config.backendApi(`/users/${user.username}/deactivate`), user);
	}

	promoteUser(user: IUser) {
		return this.http.put<void>(this.config.backendApi(`/users/${user.username}/promote`), user);
	}

	demoteUser(user: IUser) {
		return this.http.put<void>(this.config.backendApi(`/users/${user.username}/demote`), user);
	}

	internalizeUser(user: IUser) {
		return this.http.put<void>(this.config.backendApi(`/users/${user.username}/internalize`), user);
	}

	externalizeUser(user: IUser) {
		return this.http.put<void>(this.config.backendApi(`/users/${user.username}/externalize`), user);
	}
}
