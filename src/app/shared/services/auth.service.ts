import {Injectable} from '@angular/core';
import {ObMasterLayoutHeaderService} from '@oblique/oblique';
import {BehaviorSubject} from 'rxjs';
import {HttpClient} from '@angular/common/http';
import {IUser, Role, UserStatus} from '../model/user';
import {ConfigurationService} from '../../core/app-configuration/configuration.service';
import {MOCK_USER_TOKEN} from '../../core/app-configuration/token';
import {Token, TokenService} from './token.service';

@Injectable({providedIn: 'root'})
export class AuthenticationServiceV2 {
	readonly $authenticatedUser: BehaviorSubject<IUser> = new BehaviorSubject<IUser>(null);

	constructor(
		private readonly http: HttpClient,
		private readonly masterLayoutHeaderService: ObMasterLayoutHeaderService,
		private readonly configService: ConfigurationService,
		private readonly tokenService: TokenService
	) {
		this.masterLayoutHeaderService.loginState$.subscribe(state => {
			if (state !== 'SA') {
				if (this.configService.getEnvConfiguration()?.local) {
					this.tokenService.setBlueToken(new Token(MOCK_USER_TOKEN));
					this.getUser();
				} else {
					this.getUser();
				}
			} else {
				this.tokenService.removeTokens();
				this.$authenticatedUser.next(null);
			}
		});
	}

	hasAdminRole(): boolean {
		return this.$authenticatedUser.getValue()?.roles.includes(Role.ADMIN);
	}

	hasExpertRole(): boolean {
		return this.$authenticatedUser.getValue()?.roles.includes(Role.EXPERT) || this.hasAdminRole();
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

	username() {
		const user = this.$authenticatedUser.getValue();
		if (user) {
			return user.username;
		}
		return '';
	}

	private getUser() {
		this.http.get<IUser>(this.configService.backendApi('/users/authenticated')).subscribe({
			next: user => {
				this.$authenticatedUser.next(user);
			},
			error: () => {
				this.$authenticatedUser.next(null);
			}
		});
	}
}
