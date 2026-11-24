import {TestbedHarnessEnvironment} from '@angular/cdk/testing/testbed';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {MatCheckboxHarness} from '@angular/material/checkbox/testing';
import {MatPaginatorHarness} from '@angular/material/paginator/testing';
import {MatSortHarness} from '@angular/material/sort/testing';
import {provideTranslateService} from '@ngx-translate/core';
import {Observable, asapScheduler, of, scheduled, throwError} from 'rxjs';
import {provideFakeIcons, refresh} from '../../../testing/admin';
import {aUser} from '../../../testing/fixtures';
import {IPage} from '../../shared/model/page';
import {IUser, Role, UserStatus} from '../../shared/model/user';
import {AuthenticationServiceV2} from '../../shared/services/auth.service';
import {UserService} from '../../shared/services/user.service';
import {UserAccountsComponent} from './user-accounts.component';

describe('UserAccountsComponent', () => {
	let fixture: ComponentFixture<UserAccountsComponent>;
	let component: UserAccountsComponent;
	let userService: Record<'getUsers' | 'validate' | 'reactivateUser' | 'deactivateUser' | 'internalizeUser' | 'externalizeUser' | 'updateUserRoles', jest.Mock>;
	const users = (): IUser[] => [
		aUser({username: 'admin', firstName: 'Moi', roles: [Role.ADMIN]}),
		aUser({username: 'u1', firstName: 'Ada', lastName: 'Lovelace', status: UserStatus.ACTIVE, roles: [Role.USER, Role.EXPERT]}),
		aUser({username: 'u2', firstName: 'Bob', lastName: 'Marley', status: UserStatus.PENDING_ACTIVATION, roles: [Role.USER], internalUser: false}),
		aUser({username: 'u3', firstName: 'Carl', lastName: 'Sagan', status: UserStatus.INACTIVE, roles: [Role.ADMIN]})
	];
	const page = (content: IUser[], totalElements = 42): IPage<IUser> => ({content, totalElements, totalPages: 5});
	/** Réponse asynchrone, comme une requête HTTP : la liste est chargée après le premier rendu (ngAfterViewInit). */
	const later = <T>(value: T): Observable<T> => scheduled([value], asapScheduler);
	const settle = async (): Promise<void> => {
		await new Promise(resolve => setTimeout(resolve));
		refresh(fixture);
	};
	const element = (): HTMLElement => fixture.nativeElement;
	const rows = (): HTMLTableRowElement[] => Array.from(element().querySelectorAll<HTMLTableRowElement>('tr.mat-mdc-row'));
	const cells = (row: HTMLTableRowElement): string[] => Array.from(row.querySelectorAll('td')).map(cell => cell.textContent?.trim() ?? '');
	const actionButtons = (row: number): HTMLButtonElement[] => Array.from(rows()[row].querySelectorAll<HTMLButtonElement>('td.mat-column-actions button'));

	beforeEach(async () => {
		userService = {
			getUsers: jest.fn(() => later(page(users()))),
			validate: jest.fn(() => of(undefined)),
			reactivateUser: jest.fn(() => of(undefined)),
			deactivateUser: jest.fn(() => of(undefined)),
			internalizeUser: jest.fn(() => of(undefined)),
			externalizeUser: jest.fn(() => of(undefined)),
			updateUserRoles: jest.fn(() => of(undefined))
		};
		TestBed.configureTestingModule({
			imports: [UserAccountsComponent],
			providers: [
				provideTranslateService(),
				provideFakeIcons(),
				{provide: UserService, useValue: userService},
				{provide: AuthenticationServiceV2, useValue: {username: () => 'admin'}}
			]
		});
		fixture = TestBed.createComponent(UserAccountsComponent);
		component = fixture.componentInstance;
		refresh(fixture);
		await settle();
	});

	it('liste les autres utilisateurs, triés par statut', () => {
		expect(userService.getUsers).toHaveBeenCalledWith(0, 10, 'status', 'asc');
		expect(rows().map(row => cells(row).slice(0, 5))).toEqual([
			['Ada', 'Lovelace', 'ACTIVE', 'USER,EXPERT', 'yes'],
			['Bob', 'Marley', 'PENDING_ACTIVATION', 'USER', 'no'],
			['Carl', 'Sagan', 'INACTIVE', 'ADMIN', 'yes']
		]);
		expect(component.resultsLength).toBe(42);
	});

	it('propose les actions selon le statut, le rôle et le type de compte', () => {
		const actions = component.usersDataSource.data.map(user => user.actions?.map(action => action.id));

		expect(actions).toEqual([
			['deactivate', 'grant', 'externalize'],
			['validate', 'internalize'],
			['reactivate', 'externalize']
		]);
		expect(actionButtons(0)).toHaveLength(3);
		expect(rows()[1].querySelectorAll('td.mat-column-actions mat-icon')).toHaveLength(2);
	});

	it.each([
		[1, 0, 'validate'],
		[2, 0, 'reactivateUser'],
		[0, 0, 'deactivateUser'],
		[1, 1, 'internalizeUser'],
		[0, 2, 'externalizeUser']
	] as const)('exécute l’action %p/%p puis recharge la liste (%s)', (row, action, method) => {
		const user = component.usersDataSource.data[row];

		actionButtons(row)[action].click();

		expect(userService[method]).toHaveBeenCalledWith(user);
		expect(userService.getUsers).toHaveBeenCalledTimes(2);
	});

	it('modifie les rôles d’un utilisateur', async () => {
		actionButtons(0)[1].click();
		refresh(fixture);
		expect(component.isEditingRoles('u1')).toBe(true);

		const checkboxes = await TestbedHarnessEnvironment.loader(fixture).getAllHarnesses(MatCheckboxHarness);
		expect(await Promise.all(checkboxes.map(async checkbox => checkbox.isChecked()))).toEqual([true, true, false, false]);
		await checkboxes[1].uncheck();
		await checkboxes[2].check();
		rows()[0].querySelector<HTMLButtonElement>('.roles-edit-actions button')?.click();

		expect(userService.updateUserRoles).toHaveBeenCalledWith('u1', [Role.USER, Role.TRANSLATOR]);
		expect(component.editingRolesForUser).toBeNull();
		expect(userService.getUsers).toHaveBeenCalledTimes(2);
	});

	it('annule la modification des rôles', () => {
		component.startEditingRoles(component.usersDataSource.data[0]);
		refresh(fixture);

		rows()[0].querySelectorAll<HTMLButtonElement>('.roles-edit-actions button')[1].click();
		refresh(fixture);

		expect(component.editingRolesForUser).toBeNull();
		expect(component.isRoleSelected(Role.USER)).toBe(false);
		expect(rows()[0].querySelector('mat-checkbox')).toBeNull();
		expect(userService.updateUserRoles).not.toHaveBeenCalled();
	});

	it('recharge la page demandée et revient à la première page au changement de tri', async () => {
		const loader = TestbedHarnessEnvironment.loader(fixture);
		const paginator = await loader.getHarness(MatPaginatorHarness);

		await paginator.goToNextPage();
		expect(userService.getUsers).toHaveBeenLastCalledWith(1, 10, 'status', 'asc');

		const sort = await loader.getHarness(MatSortHarness);
		await (await sort.getSortHeaders({label: 'user.lastName'}))[0].click();
		expect(userService.getUsers).toHaveBeenLastCalledWith(0, 10, 'lastName', 'asc');

		component.reload();
		expect(userService.getUsers).toHaveBeenCalledTimes(4);
	});

	it('affiche une liste vide si le chargement échoue', () => {
		userService.getUsers.mockReturnValue(throwError(() => new Error('500')));

		component.reload();
		refresh(fixture);

		expect(rows()).toHaveLength(0);
		expect(component.resultsLength).toBe(0);
	});
});
