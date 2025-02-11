import {Component, OnInit} from '@angular/core';
import {MatDialog} from '@angular/material/dialog';
import {SignUpComponent} from './shared/components/sign-up/sign-up.component';
import {UserService, UserRegistrationResponse} from './shared/services/user.service';
import {ObINavigationLink, ObNotificationService} from '@oblique/oblique';
import {IUser, Role} from './shared/model/user';
import {SignInComponent} from './shared/components/sign-in/sign-in.component';
import {TokenService} from './shared/services/token.service';
import {IToken} from './shared/model/token';
import { SettingsService } from './shared/services/settings.service';
import { SettingsType } from './shared/model/settings';

@Component({
	selector: 'zco-root',
	templateUrl: './app.component.html',
	styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
	navigation: ObINavigationLink[] = [{url: '/chat', label: 'chat'}];
	navigationAdmin: ObINavigationLink[] = [
		{url: '/chat', label: 'chat'},
		{url: '/admin', label: 'admin'},
		{url: '/tips', label: 'tips.component'}
	];
	projectVersion: string;

	constructor(
		private readonly dialog: MatDialog,
		private readonly userService: UserService,
		private readonly notif: ObNotificationService,
		private readonly tokenService: TokenService,
		private readonly settingsService: SettingsService
	) {}

	ngOnInit() {
		this.settingsService.getSettings(SettingsType.PROJECT_VERSION).subscribe(
			version => this.projectVersion = version[0]
		);
	}

	getNavigation() {
		return this.userService.isAuthenticatedAsAdmin() ? this.navigationAdmin : this.navigation;
	}
	openSignUpDialog() {
		this.dialog
			.open(SignUpComponent, {width: '800px'})
			.afterClosed()
			.subscribe(result => result && this.createUser(result));
	}
	openSignInDialog() {
		this.dialog
			.open(SignInComponent, {width: '800px'})
			.afterClosed()
			.subscribe(result => result && this.loginUser(result));
	}

	createUser(user: IUser) {
		this.userService.createAccount(user).subscribe({
			next: (response: UserRegistrationResponse) => {
				this.userService.login({
					username: user.username,
					password: user.password,
					roles: [],
					organizations: user.organizations
				}).subscribe({
					next: (token: IToken) => {
						this.loginUser(token);
						this.notif.success('Registration successful');
					},
					error: () => {
						this.notif.error('Login failed after registration');
					}
				});
			},
			error: () => {
				this.notif.error('Registration failed');
			}
		});
	}

	loginUser(token: IToken) {
		this.tokenService.setToken(token);
		this.userService.refreshAuthenticatedUser();
	}

	userNotAuthenticated() {
		return !this.tokenService.getToken();
	}

	userAuthenticated() {
		return !!this.tokenService.getToken();
	}

	logout() {
		this.tokenService.logout();
		this.userService.logout();
	}
}
