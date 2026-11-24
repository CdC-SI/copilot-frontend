import {ComponentFixture, TestBed} from '@angular/core/testing';
import {MAT_DIALOG_DATA} from '@angular/material/dialog';
import {provideTranslateService} from '@ngx-translate/core';
import {Subject, of, throwError} from 'rxjs';
import {NotificationMock, notificationMock, provideNotificationMock} from '../../../../testing/angular';
import {aSourceDetail, aWorkspace, detectAsyncChanges, provideTestIcons} from '../../../../testing/shared-components';
import {SourceDto} from '../../model/source';
import {WorkspaceDto} from '../../model/workspace';
import {SourceService} from '../../services/source.service';
import {WorkspaceService} from '../../services/workspace.service';
import {WorkspaceContentDialogComponent} from './workspace-content-dialog.component';

describe('WorkspaceContentDialogComponent', () => {
	let fixture: ComponentFixture<WorkspaceContentDialogComponent>;
	let component: WorkspaceContentDialogComponent;
	let notif: NotificationMock;
	let workspaces: {getByName: jest.Mock};
	let sources: {getByName: jest.Mock};

	const el = (): HTMLElement => fixture.nativeElement;
	const panels = (): HTMLElement[] => Array.from(el().querySelectorAll('mat-expansion-panel'));
	const expand = (index: number): void => {
		panels()[index].querySelector<HTMLElement>('mat-expansion-panel-header').click();
		fixture.detectChanges();
	};

	const setup = (workspace: WorkspaceDto | Subject<WorkspaceDto> | Error): void => {
		notif = notificationMock();
		workspaces = {
			getByName: jest.fn(() => (workspace instanceof Error ? throwError(() => workspace) : workspace instanceof Subject ? workspace : of(workspace)))
		};
		sources = {getByName: jest.fn((name: string) => of(aSourceDetail({name})))};
		TestBed.configureTestingModule({
			imports: [WorkspaceContentDialogComponent],
			providers: [
				provideTranslateService(),
				provideTestIcons(),
				provideNotificationMock(notif),
				{provide: MAT_DIALOG_DATA, useValue: {workspaceName: 'retraite'}},
				{provide: WorkspaceService, useValue: workspaces},
				{provide: SourceService, useValue: sources}
			]
		});
		fixture = TestBed.createComponent(WorkspaceContentDialogComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	};

	it('affiche un indicateur pendant le chargement du workspace', () => {
		const pending = new Subject<WorkspaceDto>();
		setup(pending);

		expect(workspaces.getByName).toHaveBeenCalledWith('retraite');
		expect(el().querySelector('h2').textContent).toContain('retraite');
		expect(el().querySelector('.loading-container mat-spinner')).not.toBeNull();

		pending.next(aWorkspace());
		detectAsyncChanges(fixture);
		expect(el().querySelector('.loading-container')).toBeNull();
	});

	it('présente la description et les sources du workspace', () => {
		setup(aWorkspace());

		expect(el().querySelector('.workspace-description').textContent).toBe('Prévoyance vieillesse');
		expect(panels().map(panel => panel.querySelector('.source-name').textContent)).toEqual(['sources.avs', 'sources.lpp']);
		expect(el().querySelector('.no-sources')).toBeNull();
		expect(sources.getByName).not.toHaveBeenCalled();
	});

	it('signale un workspace sans description ni source', () => {
		setup(aWorkspace({description: null, sources: []}));

		expect(el().querySelector('.workspace-description')).toBeNull();
		expect(el().querySelector('.no-sources').textContent.trim()).toBe('corpus.workspaces.sources.empty');
		expect(el().querySelector('mat-accordion')).toBeNull();
	});

	it('charge les contenus d’une source à son ouverture', () => {
		setup(aWorkspace());
		sources.getByName.mockReturnValue(of(aSourceDetail({contents: [{title: 'Directive rentes'}, {title: null, url: 'https://ahv.ch/rentes'}]})));

		expand(0);

		expect(sources.getByName).toHaveBeenCalledWith('avs');
		const panel = panels()[0];
		expect(panel.querySelector('.source-description').textContent).toBe('Assurance-vieillesse');
		expect(Array.from(panel.querySelectorAll('.contents-list li')).map(item => item.textContent.trim())).toEqual(['Directive rentes', 'https://ahv.ch/rentes']);
		expect(panel.querySelector('.no-contents')).toBeNull();
	});

	it('signale une source sans contenu ni description', () => {
		setup(aWorkspace());
		sources.getByName.mockReturnValue(of(aSourceDetail({name: 'lpp', description: '', contents: undefined})));

		expand(1);

		const panel = panels()[1];
		expect(panel.querySelector('.source-description')).toBeNull();
		expect(panel.querySelector('.no-contents').textContent).toBe('corpus.workspaces.contents.empty');
	});

	it('affiche le chargement des contenus et ne relance pas la requête en cours ni une source déjà chargée', () => {
		setup(aWorkspace());
		const pending = new Subject<SourceDto>();
		sources.getByName.mockReturnValue(pending);

		expand(0);
		expect(component.isLoadingContents('avs')).toBe(true);
		expect(panels()[0].querySelector('.contents-loading')).not.toBeNull();
		component.loadSourceContents('avs');
		expect(sources.getByName).toHaveBeenCalledTimes(1);

		pending.next(aSourceDetail());
		detectAsyncChanges(fixture);
		expect(panels()[0].querySelector('.contents-loading')).toBeNull();
		expect(component.getContents('avs')).toEqual(aSourceDetail());

		component.loadSourceContents('avs');
		expect(sources.getByName).toHaveBeenCalledTimes(1);
	});

	it('notifie l’échec du chargement des contenus et permet de réessayer', () => {
		setup(aWorkspace());
		sources.getByName.mockReturnValueOnce(throwError(() => new Error('KO')));

		component.loadSourceContents('avs');

		expect(notif.error).toHaveBeenCalledWith('corpus.workspaces.load.error');
		expect(component.isLoadingContents('avs')).toBe(false);
		expect(component.getContents('avs')).toBeUndefined();

		component.loadSourceContents('avs');
		expect(component.getContents('avs')).toBeDefined();
	});

	it('notifie l’échec du chargement du workspace', () => {
		setup(new Error('KO'));

		expect(notif.error).toHaveBeenCalledWith('corpus.workspaces.load.error');
		expect(component.isLoading).toBe(false);
		expect(el().querySelector('.loading-container')).toBeNull();
		expect(el().querySelector('mat-accordion')).toBeNull();
	});
});
