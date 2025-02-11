import {EventEmitter, Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {ConfigurationService} from '../../core/app-configuration/configuration.service';
import {BehaviorSubject, Observable} from 'rxjs';
import {IUser, Role} from '../model/user';
import {IToken} from '../model/token';
import {TokenService} from './token.service';

export interface UserRegistrationResponse {
  userId: string;
}

@Injectable({
	providedIn: 'root'
})
export class UserService {
	userLoggedIn = new EventEmitter<void>();
	private readonly $authenticatedUser: BehaviorSubject<IUser> = new BehaviorSubject<IUser>(null);
	constructor(
		private readonly http: HttpClient,
		private readonly config: ConfigurationService,
		private readonly tokenService: TokenService
	) {
		if (this.tokenService.getToken()) {
			this.refreshAuthenticatedUser();
		}
	}

	createAccount(user: IUser): Observable<UserRegistrationResponse> {
		return this.http.post<UserRegistrationResponse>(this.config.backendApi('/users'), user);
	}

	login(user: IUser): Observable<IToken> {
		const headers = {'Content-Type': 'application/json', Accept: 'application/json'};
		return this.http.post<IToken>(this.config.backendApi('/auth'), user, {headers});
	}

	logout() {
		this.$authenticatedUser.next(null);
	}

	refreshAuthenticatedUser() {
		this.http.get<IUser>(this.config.backendApi('/users/authenticated')).subscribe(user => {
			this.$authenticatedUser.next(user);
			this.userLoggedIn.emit();
		});
	}

	getAuthenticatedUser(): Observable<IUser | null> {
		return this.$authenticatedUser.asObservable();
	}

	isAuthenticatedAsAdmin(): boolean {
		return this.$authenticatedUser.getValue()?.roles.includes(Role.ADMIN);
	}

	isAuthenticated() {
		return !!this.$authenticatedUser.getValue();
	}
}
