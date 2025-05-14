import {Component, OnInit, TemplateRef, ViewChild} from '@angular/core';
import {MatDialog} from '@angular/material/dialog';
import {UserService} from './shared/services/user.service';
import {ObINavigationLink, ObNotificationService} from '@oblique/oblique';
import {SettingsService} from './shared/services/settings.service';
import {SettingsType} from './shared/model/settings';
import {IUser, UserStatus} from './shared/model/user';
import {SignUpComponent} from './shared/components/sign-up/sign-up.component';
import {AuthenticationServiceV2} from './shared/services/auth.service';

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
		private readonly notif: ObNotificationService,
		private readonly authService: AuthenticationServiceV2
	) {}

	ngOnInit() {
		this.authService.$authenticatedUser.subscribe(user => {
			if (user) {
				this.settingsService.getSettings(SettingsType.PROJECT_VERSION).subscribe(version => (this.projectVersion = version[0]));
				switch (user.status) {
					case UserStatus.ACTIVE:
						// nothing to do
						break;
					case UserStatus.PENDING_ACTIVATION:
						this.notif.warning('copilot.account.pending.activation');
						break;
					case UserStatus.INACTIVE:
						this.notif.error('copilot.account.inactive');
						break;
					case UserStatus.GUEST:
						this.openRegisterDialog();
						break;
				}
			}
		});
	}

	getNavigation() {
		return this.authService.hasAdminRole() && this.authService.userStatus() === UserStatus.ACTIVE ? this.navigationAdmin : this.navigation;
	}

	getDisplayName() {
		return this.authService.displayName();
	}

	displayIconStatus() {
		return !!this.authService.userStatus();
	}

	getIconStatus() {
		switch (this.authService.userStatus()) {
			case UserStatus.ACTIVE:
				return {status: 'active', icon: 'checkmark-circle'};
			case UserStatus.PENDING_ACTIVATION:
				return {status: 'pending', icon: 'user-cog'};
			case UserStatus.INACTIVE:
				return {status: 'inactive', icon: 'warning-circle'};
			case UserStatus.GUEST:
				return {status: 'guest', icon: 'user-pen'};
		}
	}

	openRegisterDialog() {
		this.dialog
			.open(this.userNotRegisteredDialog)
			.afterClosed()
			.subscribe((registerUser: boolean) => {
				if (registerUser) {
					this.openSignUpDialog();
				}
			});
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
				this.notif.success('copilot.account.created');
			},
			error: () => {
				this.notif.error('copilot.account.error');
			}
		});
	}
}
