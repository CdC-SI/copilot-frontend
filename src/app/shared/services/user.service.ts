import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {ConfigurationService} from '../../core/app-configuration/configuration.service';
import {BehaviorSubject, Observable} from 'rxjs';
import {IUser, Role, UserStatus} from '../model/user';

export interface UserRegistrationResponse {
	userId: string;
}

@Injectable({
	providedIn: 'root'
})
export class UserService {
	readonly $authenticatedUser: BehaviorSubject<IUser> = new BehaviorSubject<IUser>(null);
	constructor(
		private readonly http: HttpClient,
		private readonly config: ConfigurationService
	) {
		this.refreshAuthenticatedUser();
	}

	createAccount(user: IUser): Observable<UserRegistrationResponse> {
		return this.http.post<UserRegistrationResponse>(this.config.backendApi('/users'), user);
	}

	refreshAuthenticatedUser() {
		this.http.get<IUser>(this.config.backendApi('/users/authenticated')).subscribe({
			next: user => {
				this.$authenticatedUser.next(user);
			}
		});
	}

	hasAdminRole(): boolean {
		return this.$authenticatedUser.getValue()?.roles.includes(Role.ADMIN);
	}

	isRegistered() {
		return this.$authenticatedUser.getValue()?.status === UserStatus.ACTIVE;
	}

	userStatus() {
		const user = this.$authenticatedUser.getValue();
		if (user) {
			return user.status;
		}
		return null;
	}

	displayName() {
		const user = this.$authenticatedUser.getValue();
		if (user?.firstName && user?.lastName) {
			return `${user.firstName} ${user.lastName}`;
		}
		return '';
	}
}
