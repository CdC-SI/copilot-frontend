import {TestBed} from '@angular/core/testing';
import {MatDialog} from '@angular/material/dialog';
import {BehaviorSubject, Subject, of, throwError} from 'rxjs';
import {NotificationMock, notificationMock, provideNotificationMock} from '../testing/angular';
import {aUser} from '../testing/fixtures';
import {AppComponent} from './app.component';
import {LegalDocumentDialogComponent} from './shared/components/legal-document-dialog/legal-document-dialog.component';
import {SignUpComponent} from './shared/components/sign-up/sign-up.component';
import {SettingsType} from './shared/model/settings';
import {IUser, UserStatus} from './shared/model/user';
import {AuthenticationServiceV2} from './shared/services/auth.service';
import {SettingsService} from './shared/services/settings.service';
import {UserService} from './shared/services/user.service';

/** Logique de l'enveloppe (navigation selon le rôle, statut du compte, inscription), sans rendu du gabarit. */
describe('AppComponent', () => {
	let component: AppComponent;
	let user$: BehaviorSubject<IUser>;
	let notif: NotificationMock;
	let dialogResults: Subject<unknown>[];
	let dialog: {open: jest.Mock};
	let users: {createAccount: jest.Mock; refreshAuthenticatedUser: jest.Mock};
	let settings: {getSettings: jest.Mock};

	const auth = () => ({
		$authenticatedUser: user$,
		hasAdminRole: () => !!user$.value?.roles.includes('ADMIN' as never),
		hasTranslatorRole: () => !!user$.value?.roles.some(role => ['ADMIN', 'TRANSLATOR'].includes(role)),
		userStatus: () => user$.value?.status ?? null,
		displayName: () => (user$.value ? `${user$.value.firstName} ${user$.value.lastName}` : '')
	});
	const as = (user: Partial<IUser> | null): void => user$.next(user ? aUser(user) : null);
	const lastDialog = (): Subject<unknown> => dialogResults.at(-1);

	beforeEach(() => {
		user$ = new BehaviorSubject<IUser>(null);
		notif = notificationMock();
		dialogResults = [];
		dialog = {
			open: jest.fn(() => {
				const result = new Subject<unknown>();
				dialogResults.push(result);
				return {afterClosed: () => result};
			})
		};
		users = {createAccount: jest.fn(() => of({})), refreshAuthenticatedUser: jest.fn()};
		settings = {getSettings: jest.fn(() => of(['2.4.0']))};
		TestBed.configureTestingModule({
			providers: [
				provideNotificationMock(notif),
				{provide: MatDialog, useValue: dialog},
				{provide: UserService, useValue: users},
				{provide: SettingsService, useValue: settings},
				{provide: AuthenticationServiceV2, useValue: auth()}
			]
		});
		component = TestBed.runInInjectionContext(() => new AppComponent());
		component.ngOnInit();
	});

	describe('navigation', () => {
		const urls = (): string[] => component.getNavigation().map(link => link.url);

		it.each([
			['un invité', null, ['/chat']],
			['un utilisateur actif', {roles: ['USER']}, ['/chat', '/corpus', '/tips']],
			['un traducteur', {roles: ['TRANSLATOR']}, ['/chat', '/corpus', '/tools', '/tips']],
			['un administrateur actif', {roles: ['ADMIN']}, ['/chat', '/corpus', '/admin', '/tools', '/tips']],
			['un administrateur en attente', {roles: ['ADMIN'], status: 'PENDING_ACTIVATION'}, ['/chat', '/corpus', '/tools', '/tips']],
			['un utilisateur en attente', {status: 'PENDING_ACTIVATION'}, ['/chat']]
		])('%s', (_label, user, expected) => {
			as(user as Partial<IUser>);
			notif.warning.mockClear();

			expect(urls()).toEqual(expected);
		});
	});

	it('affiche le nom et l’icône du statut de l’utilisateur', () => {
		expect(component.displayIconStatus()).toBe(false);

		as({status: UserStatus.ACTIVE});

		expect(component.displayIconStatus()).toBe(true);
		expect(component.getDisplayName()).toBe('Ada Lovelace');
	});

	it.each([
		[UserStatus.ACTIVE, 'active', 'checkmark_circle'],
		[UserStatus.PENDING_ACTIVATION, 'pending', 'person_settings'],
		[UserStatus.INACTIVE, 'inactive', 'exclamation_circle'],
		[UserStatus.GUEST, 'guest', 'person_pencil'],
		[UserStatus.JOHN_DOE, 'john-doe', 'person']
	])('statut %s : icône %s', (status, expected, icon) => {
		as({status});

		expect(component.getIconStatus()).toEqual({status: expected, icon});
	});

	describe('connexion', () => {
		it('charge la version du projet', () => {
			as({status: UserStatus.ACTIVE});

			expect(settings.getSettings).toHaveBeenCalledWith(SettingsType.PROJECT_VERSION);
			expect(component.projectVersion).toBe('2.4.0');
			expect(dialog.open).not.toHaveBeenCalled();
		});

		it('avertit d’un compte en attente d’activation ou inactif', () => {
			as({status: UserStatus.PENDING_ACTIVATION});
			as({status: UserStatus.INACTIVE});

			expect(notif.warning).toHaveBeenCalledWith('copilot.account.pending.activation');
			expect(notif.error).toHaveBeenCalledWith('copilot.account.inactive');
		});

		it('présente le compte anonyme', () => {
			as({status: UserStatus.JOHN_DOE});

			expect(dialog.open).toHaveBeenCalledWith(component.johnDoeInfoDialog);
		});
	});

	describe('inscription d’un invité', () => {
		beforeEach(() => as({status: UserStatus.GUEST}));

		it('propose l’inscription puis crée le compte avec le formulaire rempli', () => {
			const form = aUser({status: UserStatus.GUEST});

			lastDialog().next(true);
			expect(dialog.open).toHaveBeenLastCalledWith(SignUpComponent, {});
			lastDialog().next(form);

			expect(users.createAccount).toHaveBeenCalledWith(form);
			expect(users.refreshAuthenticatedUser).toHaveBeenCalled();
			expect(notif.success).toHaveBeenCalledWith('copilot.account.created');
		});

		it('signale l’échec de la création du compte', () => {
			users.createAccount.mockReturnValue(throwError(() => new Error('500')));

			lastDialog().next(true);
			lastDialog().next(aUser());

			expect(notif.error).toHaveBeenCalledWith('copilot.account.error');
			expect(users.refreshAuthenticatedUser).not.toHaveBeenCalled();
		});

		it('ne crée rien si l’invité refuse ou abandonne le formulaire', () => {
			lastDialog().next(false);
			expect(dialog.open).toHaveBeenCalledTimes(1);

			component.openRegisterDialog();
			lastDialog().next(true);
			lastDialog().next(undefined);
			expect(users.createAccount).not.toHaveBeenCalled();
		});
	});

	it('rouvre le dialogue correspondant au statut affiché', () => {
		component.openDialog('guest');
		component.openDialog('john-doe');
		component.openDialog('active');

		expect(dialog.open).toHaveBeenNthCalledWith(1, component.userNotRegisteredDialog);
		expect(dialog.open).toHaveBeenNthCalledWith(2, component.johnDoeInfoDialog);
		expect(dialog.open).toHaveBeenCalledTimes(2);
	});

	it('ouvre les documents juridiques sur l’onglet demandé', () => {
		component.openLegalDocumentDialog('gcu');

		expect(dialog.open).toHaveBeenCalledWith(LegalDocumentDialogComponent, {data: {selectedTab: 'gcu'}});
	});

	it('marque la mise en page Oblique à vérifier à chaque cycle', () => {
		const markForCheck = jest.fn();
		(component as unknown as {masterLayoutInjector: {get: () => unknown}}).masterLayoutInjector = {get: () => ({markForCheck})};

		component.ngDoCheck();
		component.ngDoCheck();

		expect(markForCheck).toHaveBeenCalledTimes(2);
	});
});
