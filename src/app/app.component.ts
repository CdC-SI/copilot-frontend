import {ChangeDetectionStrategy, ChangeDetectorRef, Component, DoCheck, Injector, OnInit, TemplateRef, ViewChild, inject} from '@angular/core';
import {MatDialog, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogTitle} from '@angular/material/dialog';
import {UserService} from './shared/services/user.service';
import {
	ObButtonDirective,
	ObExternalLinkDirective,
	ObINavigationLink,
	ObIconButtonDirective,
	ObMasterLayoutComponent,
	ObMasterLayoutModule,
	ObNotificationService,
	ObOffCanvasContainerDirective
} from '@oblique/oblique';
import {SettingsService} from './shared/services/settings.service';
import {SettingsType} from './shared/model/settings';
import {IUser, UserStatus} from './shared/model/user';
import {SignUpComponent} from './shared/components/sign-up/sign-up.component';
import {AuthenticationServiceV2} from './shared/services/auth.service';
import {LegalDocumentDialogComponent} from './shared/components/legal-document-dialog/legal-document-dialog.component';
import {MatIcon} from '@angular/material/icon';
import {MatTooltip} from '@angular/material/tooltip';
import {CdkScrollable} from '@angular/cdk/scrolling';
import {MatButton} from '@angular/material/button';
import {TranslatePipe} from '@ngx-translate/core';

@Component({
	selector: 'zco-root',
	templateUrl: './app.component.html',
	styleUrl: './app.component.css',
	changeDetection: ChangeDetectionStrategy.Eager,
	imports: [
		ObMasterLayoutModule,
		ObOffCanvasContainerDirective,
		MatIcon,
		MatTooltip,
		ObExternalLinkDirective,
		MatDialogTitle,
		CdkScrollable,
		MatDialogContent,
		MatDialogActions,
		MatButton,
		ObIconButtonDirective,
		ObButtonDirective,
		MatDialogClose,
		TranslatePipe
	]
})
export class AppComponent implements OnInit, DoCheck {
	navigationGuest: ObINavigationLink[] = [{url: '/chat', label: 'chat'}];
	navigationUser: ObINavigationLink[] = [
		{url: '/chat', label: 'chat'},
		{url: '/corpus', label: 'corpus'},
		{url: '/tips', label: 'tips.component'}
	];
	navigationTranslator: ObINavigationLink[] = [
		{url: '/chat', label: 'chat'},
		{url: '/corpus', label: 'corpus'},
		{url: '/tools', label: 'tools'},
		{url: '/tips', label: 'tips.component'}
	];
	navigationAdmin: ObINavigationLink[] = [
		{url: '/chat', label: 'chat'},
		{url: '/corpus', label: 'corpus'},
		{url: '/admin', label: 'admin'},
		{url: '/tools', label: 'tools'},
		{url: '/tips', label: 'tips.component'}
	];
	projectVersion: string;
	@ViewChild('userNotRegisteredDialog') userNotRegisteredDialog: TemplateRef<any>;
	@ViewChild('johnDoeInfoDialog') johnDoeInfoDialog: TemplateRef<any>;
	@ViewChild(ObMasterLayoutComponent, {read: Injector, static: true}) private readonly masterLayoutInjector?: Injector;
	private masterLayout?: ChangeDetectorRef;
	private readonly dialog = inject(MatDialog);
	private readonly userService = inject(UserService);
	private readonly settingsService = inject(SettingsService);
	private readonly notif = inject(ObNotificationService);
	private readonly authService = inject(AuthenticationServiceV2);

	/**
	 * Le `<router-outlet>` est dans `ObMasterLayoutComponent`, OnPush depuis Oblique 16 : sans ce marquage, les pages
	 * routées (`Eager`) ne sont vérifiées qu'après un événement DOM interne, pas après un timer ou une réponse HTTP.
	 * À retirer quand les pages notifieront elles-mêmes leurs changements (signals, FE1b/FE4).
	 */
	ngDoCheck() {
		this.masterLayout ??= this.masterLayoutInjector?.get(ChangeDetectorRef);
		this.masterLayout?.markForCheck();
	}

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
					case UserStatus.JOHN_DOE:
						this.openJohnDoeInfoDialog();
						break;
				}
			}
		});
	}

	getNavigation() {
		if (this.authService.hasAdminRole() && this.authService.userStatus() === UserStatus.ACTIVE) return this.navigationAdmin;
		else if (this.authService.hasTranslatorRole()) return this.navigationTranslator;
		else if (this.authService.userStatus() === UserStatus.ACTIVE) return this.navigationUser;
		return this.navigationGuest;
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
				return {status: 'active', icon: 'checkmark_circle'};
			case UserStatus.PENDING_ACTIVATION:
				return {status: 'pending', icon: 'person_settings'};
			case UserStatus.INACTIVE:
				return {status: 'inactive', icon: 'exclamation_circle'};
			case UserStatus.GUEST:
				return {status: 'guest', icon: 'person_pencil'};
			case UserStatus.JOHN_DOE:
				return {status: 'john-doe', icon: 'person'};
		}
	}

	/** Statuts dont l'icône ouvre une boîte de dialogue (inscription, information) : elle est alors un bouton. */
	hasStatusDialog(status: string): boolean {
		return status === 'guest' || status === 'john-doe';
	}

	openDialog(status: string) {
		if (status === 'guest') {
			this.openRegisterDialog();
		} else if (status === 'john-doe') {
			this.openJohnDoeInfoDialog();
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

	openJohnDoeInfoDialog() {
		this.dialog.open(this.johnDoeInfoDialog);
	}

	openLegalDocumentDialog(tab: 'confidentiality' | 'gcu'): void {
		this.dialog.open(LegalDocumentDialogComponent, {
			data: {selectedTab: tab}
		});
	}

	private openSignUpDialog() {
		this.dialog
			.open(SignUpComponent, {})
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
