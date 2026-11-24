import {ComponentFixture, TestBed} from '@angular/core/testing';
import {MatDialog} from '@angular/material/dialog';
import {provideTranslateService} from '@ngx-translate/core';
import {Subject, of, throwError} from 'rxjs';
import {NotificationMock, notificationMock, provideNotificationMock} from '../../../../testing/angular';
import {aWorkspace, provideTestIcons} from '../../../../testing/shared-components';
import {WorkspaceDto} from '../../model/workspace';
import {WorkspaceService} from '../../services/workspace.service';
import {WorkspaceContentDialogComponent} from '../workspace-content-dialog/workspace-content-dialog.component';
import {WorkspaceBadgeComponent} from './workspace-badge.component';

describe('WorkspaceBadgeComponent', () => {
	let fixture: ComponentFixture<WorkspaceBadgeComponent>;
	let component: WorkspaceBadgeComponent;
	let notif: NotificationMock;
	let workspaces: {getAll: jest.Mock};
	let dialog: {open: jest.Mock};
	let changes: jest.Mock;

	const el = (): HTMLElement => fixture.nativeElement;
	const menuItems = (): HTMLButtonElement[] => Array.from(document.querySelectorAll<HTMLButtonElement>('.mat-mdc-menu-panel button[mat-menu-item]'));
	const openMenu = (): void => {
		el().querySelector<HTMLButtonElement>('.workspace-badge-chevron').click();
		fixture.detectChanges();
	};
	const closeMenu = (): void => {
		document.querySelector<HTMLElement>('.cdk-overlay-backdrop')?.click();
		fixture.detectChanges();
	};

	beforeEach(() => {
		notif = notificationMock();
		workspaces = {getAll: jest.fn(() => of([aWorkspace({name: 'retraite'}), aWorkspace({id: 2, name: 'famille'})]))};
		dialog = {open: jest.fn()};
		changes = jest.fn();
		TestBed.configureTestingModule({
			imports: [WorkspaceBadgeComponent],
			providers: [
				provideTranslateService(),
				provideTestIcons(),
				provideNotificationMock(notif),
				{provide: WorkspaceService, useValue: workspaces},
				{provide: MatDialog, useValue: dialog}
			]
		});
		fixture = TestBed.createComponent(WorkspaceBadgeComponent);
		component = fixture.componentInstance;
		component.workspaceChange.subscribe(changes);
		fixture.componentRef.setInput('workspaceName', 'retraite');
		fixture.componentRef.setInput('question', 'Quand toucher ma rente ?');
		fixture.detectChanges();
	});

	afterEach(() => closeMenu());

	it('affiche le nom du workspace utilisé', () => {
		expect(el().querySelector('.badge-name').textContent).toBe('retraite');
		expect(el().querySelector('.workspace-badge-chevron').getAttribute('aria-label')).toBe('workspace.badge.change');
	});

	it('ouvre le contenu du workspace dans un dialogue', () => {
		el().querySelector<HTMLButtonElement>('.workspace-badge-label').click();

		expect(dialog.open).toHaveBeenCalledWith(WorkspaceContentDialogComponent, {width: '640px', maxWidth: '90vw', data: {workspaceName: 'retraite'}});
	});

	it('liste les workspaces à l’ouverture du menu, le courant étant coché et désactivé', () => {
		openMenu();

		expect(workspaces.getAll).toHaveBeenCalledTimes(1);
		const [current, other] = menuItems();
		expect(menuItems().map(item => item.textContent.trim())).toEqual(['retraite', 'famille']);
		expect(current.disabled).toBe(true);
		expect(current.querySelector('mat-icon')).not.toBeNull();
		expect(other.disabled).toBe(false);
		expect(other.querySelector('mat-icon')).toBeNull();
	});

	it('repose la question avec le workspace choisi', () => {
		openMenu();

		menuItems()[1].click();

		expect(changes).toHaveBeenCalledWith({question: 'Quand toucher ma rente ?', workspace: 'famille'});
	});

	it('ne repose pas la question sans question ni pour le workspace courant', () => {
		const other: WorkspaceDto = aWorkspace({name: 'famille'});

		component.selectWorkspace(aWorkspace({name: 'retraite'}));
		fixture.componentRef.setInput('question', '');
		component.selectWorkspace(other);

		expect(changes).not.toHaveBeenCalled();
	});

	it('ne recharge pas la liste aux ouvertures suivantes', () => {
		openMenu();
		closeMenu();
		openMenu();

		expect(workspaces.getAll).toHaveBeenCalledTimes(1);
	});

	it('affiche un indicateur pendant le chargement et ne relance pas de requête', () => {
		const pending = new Subject<WorkspaceDto[]>();
		workspaces.getAll.mockReturnValue(pending);
		openMenu();

		expect(document.querySelector('.workspace-menu-loading mat-spinner')).not.toBeNull();
		component.loadAvailableWorkspaces();
		expect(workspaces.getAll).toHaveBeenCalledTimes(1);

		pending.next([aWorkspace()]);
		fixture.detectChanges();
		expect(document.querySelector('.workspace-menu-loading')).toBeNull();
		expect(menuItems()).toHaveLength(1);
	});

	it('notifie l’échec du chargement et permet de réessayer', () => {
		workspaces.getAll.mockReturnValueOnce(throwError(() => new Error('KO')));

		openMenu();

		expect(notif.error).toHaveBeenCalledWith('corpus.workspaces.load.error');
		expect(component.isLoadingWorkspaces).toBe(false);
		expect(menuItems()).toHaveLength(0);

		closeMenu();
		openMenu();
		expect(workspaces.getAll).toHaveBeenCalledTimes(2);
		expect(menuItems()).toHaveLength(2);
	});
});
