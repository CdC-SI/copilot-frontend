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

	@ViewChild(MatSort) sort: MatSort;
	@ViewChild(MatPaginator) paginator: MatPaginator;

	ACTION_MATRIX: Record<UserStatus, Record<Role, string[]>> = {
		ACTIVE: {USER: ['deactivate', 'promote'], EXPERT: ['deactivate', 'demote', 'promote'], ADMIN: ['deactivate', 'demote']},
		PENDING_ACTIVATION: {USER: ['validate'], EXPERT: [], ADMIN: []},
		INACTIVE: {USER: ['reactivate'], EXPERT: ['reactivate'], ADMIN: ['reactivate']},
		GUEST: {USER: [], EXPERT: [], ADMIN: []}
	};

	ACTION_CATALOG: Record<string, IUserAction> = {
		validate: {id: 'validate', icon: 'checkmark', tooltip: 'admin.actions.validate'},
		deactivate: {id: 'deactivate', icon: 'lock', tooltip: 'admin.actions.deactivate'},
		reactivate: {id: 'reactivate', icon: 'unlock', tooltip: 'admin.actions.reactivate'},
		promote: {id: 'promote', icon: 'increase', tooltip: 'admin.actions.promote'},
		demote: {id: 'demote', icon: 'decrease', tooltip: 'admin.actions.demote'},
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
			case 'promote':
				call$ = this.userService.promoteUser(user);
				break;
			case 'demote':
				call$ = this.userService.demoteUser(user);
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
