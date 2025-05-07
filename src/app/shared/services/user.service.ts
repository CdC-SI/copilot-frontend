import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {ConfigurationService} from '../../core/app-configuration/configuration.service';
import {Observable} from 'rxjs';
import {IUser} from '../model/user';
import {AuthenticationServiceV2} from './auth.service';

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
}
