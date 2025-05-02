import {Component, OnInit, TemplateRef, ViewChild} from '@angular/core';
import {MatDialog} from '@angular/material/dialog';
import {UserService} from './shared/services/user.service';
import {ObINavigationLink, ObNotificationService} from '@oblique/oblique';
import {SettingsService} from './shared/services/settings.service';
import {SettingsType} from './shared/model/settings';
import {IUser, Role} from './shared/model/user';
import {SignUpComponent} from './shared/components/sign-up/sign-up.component';

@Component({
	selector: 'zco-root',
	templateUrl: './app.component.html',
	styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
	navigation: ObINavigationLink[] = [];
	navigationAdmin: ObINavigationLink[] = [
		{url: '/chat', label: 'chat'},
		{url: '/admin', label: 'admin'},
		{url: '/tips', label: 'tips.component'}
	];
	projectVersion: string;
	@ViewChild('userNotRegisteredDialog') userNotRegisteredDialog: TemplateRef<any>;

	constructor(
		private readonly dialog: MatDialog,
		private readonly userService: UserService,
		private readonly settingsService: SettingsService,
		private readonly notif: ObNotificationService
	) {}

	ngOnInit() {
		this.settingsService.getSettings(SettingsType.PROJECT_VERSION).subscribe(version => (this.projectVersion = version[0]));
		this.userService.$authenticatedUser.subscribe(user => {
			if (!user.roles?.includes(Role.USER)) {
				this.dialog
					.open(this.userNotRegisteredDialog)
					.afterClosed()
					.subscribe((registerUser: boolean) => {
						if (registerUser) {
							this.openSignUpDialog();
						}
					});
			}
		});
	}

	getNavigation() {
		return this.userService.hasAdminRole() ? this.navigationAdmin : this.navigation;
	}

	getDisplayName() {
		return this.userService.displayName();
	}

	private openSignUpDialog() {
		this.dialog
			.open(SignUpComponent, {width: '800px'})
			.afterClosed()
			.subscribe(result => result && this.createUser(result));
	}

	private createUser(user: IUser) {
		this.userService.createAccount(user).subscribe({
			next: () => {
				this.userService.refreshAuthenticatedUser();
				this.notif.success('Registration successful');
			},
			error: () => {
				this.notif.error('Registration failed');
			}
		});
	}
}
