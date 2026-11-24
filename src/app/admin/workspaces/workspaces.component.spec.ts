import {ComponentFixture, TestBed} from '@angular/core/testing';
import {provideTranslateService} from '@ngx-translate/core';
import {of, throwError} from 'rxjs';
import {DialogMock, aWorkspaceDto, dialogMock, provideDialogMock, provideFakeIcons, refresh} from '../../../testing/admin';
import {NotificationMock, notificationMock, provideNotificationMock} from '../../../testing/angular';
import {ConfirmDialogComponent} from '../../shared/components/confirm-dialog/confirm-dialog.component';
import {WorkspaceService} from '../../shared/services/workspace.service';
import {CatalogImportDialogComponent} from '../catalog-import-dialog/catalog-import-dialog.component';
import {WorkspaceEditDialogComponent, WorkspaceEditDialogResult} from './workspace-edit-dialog/workspace-edit-dialog.component';
import {WorkspacesComponent} from './workspaces.component';

describe('WorkspacesComponent', () => {
	let fixture: ComponentFixture<WorkspacesComponent>;
	let component: WorkspacesComponent;
	let notifications: NotificationMock;
	let dialog: DialogMock;
	let workspaceService: {getAll: jest.Mock; create: jest.Mock; update: jest.Mock; delete: jest.Mock};
	let selected: string[];
	const retraite = aWorkspaceDto();
	const vide = aWorkspaceDto({id: 2, name: 'vide', description: null, hypotheticalQuestions: [], sources: []});
	const element = (): HTMLElement => fixture.nativeElement;
	const rows = (): HTMLElement[] => Array.from(element().querySelectorAll<HTMLElement>('tr.workspace-row'));
	const cells = (row: HTMLElement): string[] => Array.from(row.querySelectorAll('td')).map(cell => cell.textContent?.trim() ?? '');
	const detail = (index: number): HTMLElement => element().querySelectorAll<HTMLElement>('tr.detail-row')[index];
	const actionBar = (index: number): HTMLButtonElement => element().querySelectorAll<HTMLButtonElement>('.actions-bar button')[index];
	const rowButton = (row: number, column: string, index = 0): HTMLButtonElement =>
		rows()[row].querySelectorAll<HTMLButtonElement>(`td.mat-column-${column} button`)[index];

	beforeEach(() => {
		notifications = notificationMock();
		dialog = dialogMock();
		workspaceService = {
			getAll: jest.fn(() => of([retraite, vide])),
			create: jest.fn(() => of(retraite)),
			update: jest.fn(() => of(retraite)),
			delete: jest.fn(() => of(undefined))
		};
		TestBed.configureTestingModule({
			imports: [WorkspacesComponent],
			providers: [
				provideTranslateService(),
				provideFakeIcons(),
				provideNotificationMock(notifications),
				provideDialogMock(dialog),
				{provide: WorkspaceService, useValue: workspaceService}
			]
		});
		fixture = TestBed.createComponent(WorkspacesComponent);
		component = fixture.componentInstance;
		selected = [];
		component.sourceSelected.subscribe(name => selected.push(name));
		refresh(fixture);
	});

	it('liste les workspaces', () => {
		expect(rows()).toHaveLength(2);
		expect(cells(rows()[0])).toEqual(['retraite', 'Prévoyance vieillesse', 'admin.workspaces.sources.count', '2026-01-02 10:00', '']);
	});

	it('déplie un workspace avec ses questions et ses sources, puis le replie', () => {
		rows()[0].click();
		refresh(fixture);

		const chips = Array.from(detail(0).querySelectorAll('mat-chip')).map(chip => chip.textContent?.trim());
		expect(chips).toEqual(['Comment calculer ma rente ?', 'sources.avs', 'sources.lpp']);

		rowButton(0, 'sources').click();
		refresh(fixture);

		expect(component.isExpanded(retraite)).toBe(false);
		expect(detail(0).querySelector('mat-chip')).toBeNull();
	});

	it('indique un workspace sans source', () => {
		component.toggleExpand(vide);
		refresh(fixture);

		expect(detail(1).querySelector('.no-sources')?.textContent).toBe('admin.workspaces.sources.empty');
		expect(detail(1).querySelector('.hypothetical-questions')).toBeNull();
	});

	it('émet la source choisie pour l’afficher dans l’onglet Sources', () => {
		component.toggleExpand(retraite);
		refresh(fixture);

		detail(0).querySelector<HTMLElement>('.clickable-source-chip')?.click();

		expect(selected).toEqual(['avs']);
		expect(component.isExpanded(retraite)).toBe(true);
	});

	it('notifie un échec de chargement', () => {
		workspaceService.getAll.mockReturnValue(throwError(() => new Error('500')));

		component.reload();

		expect(notifications.error).toHaveBeenCalledWith('admin.workspaces.load.error');
	});

	it('crée un workspace depuis la modale puis recharge la liste', () => {
		const result: WorkspaceEditDialogResult = {name: 'ai', request: {name: 'ai', sources: ['ai']}, isEdit: false};
		dialog.result = result;

		actionBar(1).click();

		expect(dialog.open).toHaveBeenCalledWith(WorkspaceEditDialogComponent, {width: '500px', data: {workspace: undefined}});
		expect(workspaceService.create).toHaveBeenCalledWith(result.request);
		expect(notifications.success).toHaveBeenCalledWith('admin.workspaces.create.success');
		expect(workspaceService.getAll).toHaveBeenCalledTimes(2);
	});

	it('modifie un workspace depuis la modale', () => {
		dialog.result = {name: 'retraite', request: {sources: ['avs']}, isEdit: true};

		rowButton(0, 'actions').click();

		expect(dialog.open).toHaveBeenCalledWith(WorkspaceEditDialogComponent, {width: '500px', data: {workspace: retraite}});
		expect(workspaceService.update).toHaveBeenCalledWith('retraite', {sources: ['avs']});
		expect(notifications.success).toHaveBeenCalledWith('admin.workspaces.update.success');
		expect(component.isExpanded(retraite)).toBe(false);
	});

	it('notifie l’échec d’une création ou d’une modification et ignore une annulation', () => {
		component.openCreateDialog();
		expect(workspaceService.create).not.toHaveBeenCalled();

		workspaceService.create.mockReturnValue(throwError(() => new Error('409')));
		workspaceService.update.mockReturnValue(throwError(() => new Error('500')));
		dialog.result = {name: 'ai', request: {name: 'ai'}, isEdit: false};
		component.openCreateDialog();
		dialog.result = {name: 'retraite', request: {}, isEdit: true};
		component.openEditDialog(retraite);

		expect(notifications.error).toHaveBeenCalledWith('admin.workspaces.create.error');
		expect(notifications.error).toHaveBeenCalledWith('admin.workspaces.update.error');
	});

	it('supprime un workspace après confirmation seulement', () => {
		rowButton(1, 'actions', 1).click();
		expect(dialog.open).toHaveBeenCalledWith(ConfirmDialogComponent, expect.objectContaining({data: expect.objectContaining({type: 'warning'})}));
		expect(workspaceService.delete).not.toHaveBeenCalled();

		dialog.result = true;
		component.delete(vide);
		expect(workspaceService.delete).toHaveBeenCalledWith('vide');
		expect(notifications.success).toHaveBeenCalledWith('admin.workspaces.delete.success');

		workspaceService.delete.mockReturnValue(throwError(() => new Error('500')));
		component.delete(vide);
		expect(notifications.error).toHaveBeenCalledWith('admin.workspaces.delete.error');
	});

	it('recharge la liste après un import du catalogue appliqué', () => {
		actionBar(0).click();
		expect(dialog.open).toHaveBeenCalledWith(CatalogImportDialogComponent, {width: '700px'});
		expect(workspaceService.getAll).toHaveBeenCalledTimes(1);

		dialog.result = {imported: true};
		component.openImportDialog();
		expect(workspaceService.getAll).toHaveBeenCalledTimes(2);
	});
});
