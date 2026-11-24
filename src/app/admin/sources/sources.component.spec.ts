import {ComponentFixture, TestBed} from '@angular/core/testing';
import {provideTranslateService} from '@ngx-translate/core';
import {Subject, of, throwError} from 'rxjs';
import {DialogMock, aSourceDto, dialogMock, provideDialogMock, provideFakeIcons, refresh} from '../../../testing/admin';
import {NotificationMock, notificationMock, provideNotificationMock} from '../../../testing/angular';
import {ConfirmDialogComponent} from '../../shared/components/confirm-dialog/confirm-dialog.component';
import {SourceDto} from '../../shared/model/source';
import {SourceService} from '../../shared/services/source.service';
import {CatalogImportDialogComponent} from '../catalog-import-dialog/catalog-import-dialog.component';
import {SourceEditDialogComponent, SourceEditDialogResult} from './source-edit-dialog/source-edit-dialog.component';
import {SourcesComponent} from './sources.component';

describe('SourcesComponent', () => {
	let fixture: ComponentFixture<SourcesComponent>;
	let component: SourcesComponent;
	let notifications: NotificationMock;
	let dialog: DialogMock;
	let sourceService: {getAll: jest.Mock; getByName: jest.Mock; create: jest.Mock; update: jest.Mock; delete: jest.Mock};
	const avs = aSourceDto({name: 'avs', hypotheticalQuestions: ['Quand toucher la rente ?']});
	const lpp = aSourceDto({id: 2, name: 'lpp', description: 'Prévoyance professionnelle', hypotheticalQuestions: []});
	const element = (): HTMLElement => fixture.nativeElement;
	const rows = (): HTMLElement[] => Array.from(element().querySelectorAll<HTMLElement>('tr.source-row'));
	const cells = (row: HTMLElement): string[] => Array.from(row.querySelectorAll('td')).map(cell => cell.textContent?.trim() ?? '');
	const detail = (index: number): HTMLElement => element().querySelectorAll<HTMLElement>('tr.detail-row')[index];
	const actionBar = (index: number): HTMLButtonElement => element().querySelectorAll<HTMLButtonElement>('.actions-bar button')[index];
	const rowButton = (row: number, column: string, index = 0): HTMLButtonElement =>
		rows()[row].querySelectorAll<HTMLButtonElement>(`td.mat-column-${column} button`)[index];

	beforeEach(() => {
		notifications = notificationMock();
		dialog = dialogMock();
		sourceService = {
			getAll: jest.fn(() => of([avs, lpp])),
			getByName: jest.fn((name: string) => of(aSourceDto({name, contents: [{title: 'directive-avs.pdf'}, {url: 'https://www.ahv-iv.ch'}]}))),
			create: jest.fn(() => of(avs)),
			update: jest.fn(() => of(avs)),
			delete: jest.fn(() => of(undefined))
		};
		TestBed.configureTestingModule({
			imports: [SourcesComponent],
			providers: [
				provideTranslateService(),
				provideFakeIcons(),
				provideNotificationMock(notifications),
				provideDialogMock(dialog),
				{provide: SourceService, useValue: sourceService}
			]
		});
		fixture = TestBed.createComponent(SourcesComponent);
		component = fixture.componentInstance;
		refresh(fixture);
	});

	it('liste les sources', () => {
		expect(rows()).toHaveLength(2);
		expect(cells(rows()[1])).toEqual(['sources.lpp', 'Prévoyance professionnelle', 'admin.sources.contents.label', '2026-01-02 10:00', '']);
	});

	it('déplie une source avec ses questions et ses contenus, puis la replie', () => {
		const scrollIntoView = jest.fn();
		rows()[0].scrollIntoView = scrollIntoView;

		rows()[0].click();
		refresh(fixture);

		expect(sourceService.getByName).toHaveBeenCalledWith('avs');
		expect(detail(0).querySelector('mat-chip')?.textContent?.trim()).toBe('Quand toucher la rente ?');
		expect(Array.from(detail(0).querySelectorAll('.contents-list li')).map(item => item.textContent?.trim())).toEqual([
			'directive-avs.pdf',
			'https://www.ahv-iv.ch'
		]);
		expect(detail(1).textContent?.trim()).toBe('');

		rowButton(0, 'contents').click();
		refresh(fixture);

		expect(component.expandedSourceName).toBeNull();
		expect(detail(0).querySelector('.contents-list')).toBeNull();
	});

	it('met en évidence la source choisie depuis un workspace, après chargement', async () => {
		const detail$ = new Subject<SourceDto>();
		sourceService.getByName.mockReturnValue(detail$);
		const scrollIntoView = jest.fn();
		rows()[1].scrollIntoView = scrollIntoView;

		component.expandSourceByName('lpp');
		refresh(fixture);
		expect(detail(1).querySelector('.contents-loading')).not.toBeNull();

		detail$.next(aSourceDto({name: 'lpp', contents: []}));
		refresh(fixture);
		await Promise.resolve();

		expect(detail(1).querySelector('.no-contents')?.textContent).toBe('admin.sources.contents.empty');
		expect(scrollIntoView).toHaveBeenCalledWith({behavior: 'smooth', block: 'center'});
	});

	it('notifie les échecs de chargement', () => {
		sourceService.getAll.mockReturnValue(throwError(() => new Error('500')));
		sourceService.getByName.mockReturnValue(throwError(() => new Error('500')));

		component.reload();
		component.expandSourceByName('avs');

		expect(notifications.error).toHaveBeenCalledTimes(2);
		expect(notifications.error).toHaveBeenCalledWith('admin.sources.load.error');
		expect(component.loadingDetail).toBe(false);
	});

	it('crée une source depuis la modale puis recharge la liste', () => {
		const result: SourceEditDialogResult = {name: 'ai', request: {name: 'ai', description: 'Invalidité'}, isEdit: false};
		dialog.result = result;

		actionBar(1).click();

		expect(dialog.open).toHaveBeenCalledWith(SourceEditDialogComponent, {width: '500px', data: {source: undefined}});
		expect(sourceService.create).toHaveBeenCalledWith(result.request);
		expect(notifications.success).toHaveBeenCalledWith('admin.sources.create.success');
		expect(sourceService.getAll).toHaveBeenCalledTimes(2);
	});

	it('modifie une source depuis la modale', () => {
		dialog.result = {name: 'avs', request: {description: 'AVS'}, isEdit: true};

		rowButton(0, 'actions').click();

		expect(dialog.open).toHaveBeenCalledWith(SourceEditDialogComponent, {width: '500px', data: {source: avs}});
		expect(sourceService.update).toHaveBeenCalledWith('avs', {description: 'AVS'});
		expect(notifications.success).toHaveBeenCalledWith('admin.sources.update.success');
		expect(sourceService.getByName).not.toHaveBeenCalled();
	});

	it('notifie l’échec d’une création ou d’une modification', () => {
		sourceService.create.mockReturnValue(throwError(() => new Error('409')));
		sourceService.update.mockReturnValue(throwError(() => new Error('500')));

		dialog.result = {name: 'avs', request: {name: 'avs'}, isEdit: false};
		component.openCreateDialog();
		dialog.result = {name: 'avs', request: {}, isEdit: true};
		component.openEditDialog(avs);

		expect(notifications.error).toHaveBeenCalledWith('admin.sources.create.error');
		expect(notifications.error).toHaveBeenCalledWith('admin.sources.update.error');
	});

	it('ne fait rien si la modale est annulée', () => {
		component.openCreateDialog();
		component.delete(avs);

		expect(sourceService.create).not.toHaveBeenCalled();
		expect(sourceService.delete).not.toHaveBeenCalled();
	});

	it('supprime une source après confirmation', () => {
		dialog.result = true;

		rowButton(1, 'actions', 1).click();

		expect(dialog.open).toHaveBeenCalledWith(ConfirmDialogComponent, expect.objectContaining({data: expect.objectContaining({type: 'warning'})}));
		expect(sourceService.delete).toHaveBeenCalledWith('lpp');
		expect(notifications.success).toHaveBeenCalledWith('admin.sources.delete.success');
		expect(sourceService.getAll).toHaveBeenCalledTimes(2);

		sourceService.delete.mockReturnValue(throwError(() => new Error('500')));
		component.delete(lpp);
		expect(notifications.error).toHaveBeenCalledWith('admin.sources.delete.error');
	});

	it('recharge la liste après un import du catalogue appliqué', () => {
		actionBar(0).click();
		expect(dialog.open).toHaveBeenCalledWith(CatalogImportDialogComponent, {width: '700px'});
		expect(sourceService.getAll).toHaveBeenCalledTimes(1);

		dialog.result = {imported: true};
		component.openImportDialog();
		expect(sourceService.getAll).toHaveBeenCalledTimes(2);
	});
});
