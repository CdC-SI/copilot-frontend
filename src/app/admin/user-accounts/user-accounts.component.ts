import {AfterViewInit, Component, ViewChild} from '@angular/core';
import {MatTableDataSource} from '@angular/material/table';
import {IUser, IUserAction, Role, UserStatus} from '../../shared/model/user';
import {Observable, Subject, catchError, finalize, map, merge, of, startWith, switchMap} from 'rxjs';
import {UserService} from '../../shared/services/user.service';
import {AuthenticationServiceV2} from '../../shared/services/auth.service';
import {IPage} from '../../shared/model/page';
import {MatSort} from '@angular/material/sort';
import {MatPaginator} from '@angular/material/paginator';

@Component({
	selector: 'zco-user-accounts',
	templateUrl: './user-accounts.component.html',
	styleUrl: './user-accounts.component.scss'
})
export class UserAccountsComponent implements AfterViewInit {
	displayedColumns: string[] = ['firstName', 'lastName', 'status', 'roles', 'internalUser', 'actions'];
	usersDataSource = new MatTableDataSource<IUser>();
	resultsLength = 0;
	pageSize = 10;
	defaultSort = {active: 'status', direction: 'asc' as const};

	editingRolesForUser: string | null = null;
	selectedRoles: Set<Role> = new Set();
	availableRoles = [Role.USER, Role.EXPERT, Role.TRANSLATOR, Role.ADMIN];

	@ViewChild(MatSort) sort: MatSort;
	@ViewChild(MatPaginator) paginator: MatPaginator;

	ACTION_MATRIX: Record<UserStatus, Record<Role, string[]>> = {
		ACTIVE: {
			USER: ['deactivate', 'grant'],
			EXPERT: ['deactivate', 'grant'],
			TRANSLATOR: ['deactivate', 'grant'],
			ADMIN: ['deactivate', 'grant']
		},
		PENDING_ACTIVATION: {USER: ['validate'], EXPERT: [], TRANSLATOR: [], ADMIN: []},
		INACTIVE: {USER: ['reactivate'], EXPERT: ['reactivate'], TRANSLATOR: ['reactivate'], ADMIN: ['reactivate']},
		GUEST: {USER: [], EXPERT: [], TRANSLATOR: [], ADMIN: []},
		JOHN_DOE: {USER: [], EXPERT: [], TRANSLATOR: [], ADMIN: []}
	};

	ACTION_CATALOG: Record<string, IUserAction> = {
		validate: {id: 'validate', icon: 'checkmark', tooltip: 'admin.actions.validate'},
		deactivate: {id: 'deactivate', icon: 'lock', tooltip: 'admin.actions.deactivate'},
		reactivate: {id: 'reactivate', icon: 'unlock', tooltip: 'admin.actions.reactivate'},
		grant: {id: 'grant', icon: 'user', tooltip: 'admin.actions.grant'},
		internalize: {id: 'internalize', icon: 'eye', tooltip: 'admin.actions.internalize'},
		externalize: {id: 'externalize', icon: 'eye-slash', tooltip: 'admin.actions.externalize'}
	};

	private readonly refresh$ = new Subject<void>();

	constructor(
		private readonly userService: UserService,
		private readonly authService: AuthenticationServiceV2
	) {}

	ngAfterViewInit(): void {
		this.sort.sortChange.subscribe(() => (this.paginator.pageIndex = 0));
		merge(this.sort.sortChange, this.paginator.page, this.refresh$)
			.pipe(
				startWith({}),
				switchMap(() =>
					this.userService.getUsers(this.paginator.pageIndex, this.paginator.pageSize, this.sort.active, this.sort.direction || 'asc').pipe(
						catchError(() =>
							of({
								content: [] as IUser[],
								totalElements: 0,
								totalPages: 0
							} as IPage<IUser>)
						)
					)
				),
				map((page: IPage<IUser>) => {
					this.resultsLength = page.totalElements;
					return page.content.filter(user => user.username !== this.authService.username());
				})
			)
			.subscribe(users => {
				users.forEach(u => (u.actions = this.getActions(u)));
				this.usersDataSource.data = users;
			});
	}

	reload(): void {
		this.refresh$.next();
	}

	onAction(action: string, user: IUser): void {
		if (action === 'grant') {
			this.startEditingRoles(user);
			return;
		}

		let call$: Observable<void>;
		switch (action) {
			case 'validate':
				call$ = this.userService.validate(user);
				break;
			case 'reactivate':
				call$ = this.userService.reactivateUser(user);
				break;
			case 'deactivate':
				call$ = this.userService.deactivateUser(user);
				break;
			case 'internalize':
				call$ = this.userService.internalizeUser(user);
				break;
			case 'externalize':
				call$ = this.userService.externalizeUser(user);
				break;
		}
		call$.pipe(finalize(() => this.refresh$.next())).subscribe();
	}

	startEditingRoles(user: IUser): void {
		this.editingRolesForUser = user.username;
		this.selectedRoles = new Set(user.roles);
	}

	toggleRole(role: Role): void {
		if (this.selectedRoles.has(role)) {
			this.selectedRoles.delete(role);
		} else {
			this.selectedRoles.add(role);
		}
	}

	isRoleSelected(role: Role): boolean {
		return this.selectedRoles.has(role);
	}

	cancelEditingRoles(): void {
		this.editingRolesForUser = null;
		this.selectedRoles.clear();
	}

	saveRoles(username: string): void {
		const roles = Array.from(this.selectedRoles);
		this.userService
			.updateUserRoles(username, roles)
			.pipe(
				finalize(() => {
					this.editingRolesForUser = null;
					this.selectedRoles.clear();
					this.refresh$.next();
				})
			)
			.subscribe();
	}

	isEditingRoles(username: string): boolean {
		return this.editingRolesForUser === username;
	}

	private getActions(user: IUser): IUserAction[] {
		let role: Role;
		if (user.roles.includes(Role.ADMIN)) {
			role = Role.ADMIN;
		} else if (user.roles.includes(Role.EXPERT)) {
			role = Role.EXPERT;
		} else {
			role = Role.USER;
		}

		const actions = this.ACTION_MATRIX[user.status][role].map(id => ({
			...this.ACTION_CATALOG[id]
		}));

		if (user.internalUser) {
			actions.push(this.ACTION_CATALOG['externalize']);
		} else {
			actions.push(this.ACTION_CATALOG['internalize']);
		}

		return actions;
	}
}
