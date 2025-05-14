import {AfterViewInit, Component, OnInit, ViewChild} from '@angular/core';
import {FormBuilder, FormGroup} from '@angular/forms';
import {MatDialog} from '@angular/material/dialog';
import {ConfirmDialogComponent} from '../shared/components/confirm-dialog/confirm-dialog.component';
import {ObNotificationService} from '@oblique/oblique';
import {FaqItemsService} from '../shared/services/faq-items.service';
import {MatTableDataSource} from '@angular/material/table';
import {IUser, IUserAction, Role, UserStatus} from '../shared/model/user';
import {MatSort} from '@angular/material/sort';
import {UserService} from '../shared/services/user.service';
import {MatPaginator} from '@angular/material/paginator';
import {Observable, Subject, catchError, finalize, map, merge, of, startWith, switchMap} from 'rxjs';
import {IPage} from '../shared/model/page';
import {AuthenticationServiceV2} from '../shared/services/auth.service';

@Component({
	selector: 'zco-admin',
	templateUrl: './admin.component.html',
	styleUrl: './admin.component.scss'
})
export class AdminComponent implements OnInit, AfterViewInit {
	addFaqItemFormGrp: FormGroup;
	displayedColumns: string[] = ['firstName', 'lastName', 'status', 'roles', 'actions'];
	usersDataSource = new MatTableDataSource<IUser>();
	resultsLength = 0;
	pageSize = 10;
	defaultSort = {active: 'status', direction: 'asc' as const};

	@ViewChild(MatSort) sort: MatSort;
	@ViewChild(MatPaginator) paginator: MatPaginator;

	ACTION_MATRIX: Record<UserStatus, Record<Role, string[]>> = {
		ACTIVE: {USER: ['deactivate', 'promote'], ADMIN: ['deactivate', 'demote']},
		PENDING_ACTIVATION: {USER: ['validate'], ADMIN: []},
		INACTIVE: {USER: ['reactivate'], ADMIN: ['reactivate']},
		GUEST: {USER: [], ADMIN: []}
	};

	ACTION_CATALOG: Record<string, IUserAction> = {
		validate: {id: 'validate', icon: 'checkmark', tooltip: 'admin.actions.validate'},
		deactivate: {id: 'deactivate', icon: 'lock', tooltip: 'admin.actions.deactivate'},
		reactivate: {id: 'reactivate', icon: 'unlock', tooltip: 'admin.actions.reactivate'},
		promote: {id: 'promote', icon: 'increase', tooltip: 'admin.actions.promote'},
		demote: {id: 'demote', icon: 'decrease', tooltip: 'admin.actions.demote'}
	};

	private readonly refresh$ = new Subject<void>();

	constructor(
		private readonly fb: FormBuilder,
		private readonly faqItemsService: FaqItemsService,
		private readonly dialog: MatDialog,
		private readonly notifService: ObNotificationService,
		private readonly userService: UserService,
		private readonly authService: AuthenticationServiceV2
	) {}

	ngOnInit(): void {
		this.addFaqItemFormGrp = this.fb.group({
			['faqItem']: ['']
		});
	}

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

	submitFAQItem(): void {
		this.dialog
			.open(ConfirmDialogComponent, {
				width: '400',
				data: {title: 'add.question.answer.ask', content: 'add.question.answer.explanation', type: 'warning'}
			})
			.afterClosed()
			.subscribe((result: boolean) => {
				if (result) {
					this.faqItemsService.add(this.addFaqItemFormGrp.controls['faqItem'].value).subscribe({
						next: () => {
							this.addFaqItemFormGrp.reset();
							this.notifService.success('add.question.answer.success');
						}
					});
				}
			});
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
		}
		call$.pipe(finalize(() => this.refresh$.next())).subscribe();
	}

	private getActions(user: IUser): IUserAction[] {
		const role = user.roles.includes(Role.ADMIN) ? Role.ADMIN : Role.USER;
		return this.ACTION_MATRIX[user.status][role].map(id => ({
			...this.ACTION_CATALOG[id]
		}));
	}
}
