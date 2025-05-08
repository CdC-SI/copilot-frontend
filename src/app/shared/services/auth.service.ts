import {Inject, Injectable} from '@angular/core';
import {ObNotificationService, WINDOW} from '@oblique/oblique';
import {DOCUMENT, LocationStrategy} from '@angular/common';
import {EnvironmentService, LocalStorageService} from 'zas-design-system';
import {BehaviorSubject, EMPTY, Observable, catchError, mergeMap, of} from 'rxjs';
import {HttpClient, HttpErrorResponse, HttpStatusCode} from '@angular/common/http';
import {map} from 'rxjs/operators';
import {IUser, Role, UserStatus} from '../model/user';

@Injectable({providedIn: 'root'})
export class AuthenticationServiceV2 {
	readonly $authenticatedUser: BehaviorSubject<IUser> = new BehaviorSubject<IUser>(null);
	private _jwtToken: string | null = null;

	constructor(
		private readonly localStorageService: LocalStorageService,
		private readonly locationStrategy: LocationStrategy,
		private readonly environmentService: EnvironmentService,
		private readonly http: HttpClient,
		private readonly notification: ObNotificationService,
		@Inject(WINDOW) private readonly window: Window,
		@Inject(DOCUMENT) private readonly document: Document
	) {
		this.localStorageService.initData();
	}

	get jwtToken(): string | null {
		return this._jwtToken;
	}

	set jwtToken(value: string | null) {
		this._jwtToken = value;
	}

	/**
	 * Login case on app startup, we have a token
	 */
	login(): void {
		// eslint-disable-next-line prefer-regex-literals
		const match: RegExpExecArray | null = RegExp('[?&]ACCESS_TOKEN').exec(this.window.location.search);
		/*
		 * No token on startup, redirect to /v2/authenticate
		 */
		if (!match) {
			const defaultUrl = `${this.environmentService.current?.gatewayUrl}/v2/authenticate-eiam?redirect=${this.window.location.href}`;
			this.window.location.replace(defaultUrl);
		}
	}

	/**
	 * Logout and do a redirect
	 */
	logout(redirect?: string): void {
		this.jwtToken = null;
		this.localStorageService.setConnected(false);

		// If redirect is undefined we redirect to the root of the application
		if (!redirect) {
			redirect = `${this.window.location.origin}${this.locationStrategy.getBaseHref()}`;
		}

		this.window.location.replace(`${this.environmentService.current?.gatewayUrl}/v2/logout?redirect=${redirect}`);
	}

	getFullToken(): Observable<string> {
		return this.http
			.get<string>(`${this.environmentService.current?.gatewayUrl}/v2/fulltoken-eiam`, {
				withCredentials: true
			})
			.pipe(
				mergeMap(token => {
					this.jwtToken = token;
					this.localStorageService.setConnected(true);
					const uri = this.window.location.toString();
					if (uri.indexOf('?') > 0) {
						this.window.history.replaceState({}, this.document.title, cleanUri(uri));
					}
					return of(token);
				}),
				map(token => token),
				catchError((err: unknown) => {
					if (err instanceof HttpErrorResponse) {
						if (err.status === HttpStatusCode.Unauthorized) {
							this.notification.error('i18n.authentication.silent-auth.fail');
						} else {
							this.notification.error('i18n.oblique.http.error.general');
						}
					} else {
						this.notification.error('i18n.oblique.http.error.general');
					}
					return EMPTY;
				})
			);
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

	/**
	 * Removed a parameter from url if url is not compliant
	 */
	private removeParameterFromUrl(url: string, parameter: string) {
		return url.replace(new RegExp(`([?&]${parameter}=[^&#]*)(#.*)?.*`), '$1');
	}

	/**
	 * To encode in b64 we use encodeURIComponent to get percent-encoded UTF-8,
	 * then we convert the percent encodings into raw bytes which can be fed into btoa.
	 */
	private b64EncodeUnicode(string: string) {
		return btoa(
			encodeURIComponent(string).replace(/%([0-9A-F]{2})/g, function toSolidBytes(match, p1) {
				return String.fromCharCode(Number(`0x${p1}`));
			})
		);
	}
}

export function cleanUri(uri: string): string {
	if (uri && uri.indexOf('?') > 0) {
		return uri.substring(0, uri.indexOf('?'));
	}
	return uri;
}
