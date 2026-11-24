import {TestbedHarnessEnvironment} from '@angular/cdk/testing/testbed';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {MatExpansionPanelHarness} from '@angular/material/expansion/testing';
import {provideTranslateService} from '@ngx-translate/core';
import {Subject, of, throwError} from 'rxjs';
import {aSourceDto, aWorkspaceDto, provideFakeIcons, refresh} from '../../../testing/admin';
import {NotificationMock, notificationMock, provideNotificationMock} from '../../../testing/angular';
import {SourceDto} from '../../shared/model/source';
import {SourceService} from '../../shared/services/source.service';
import {WorkspaceService} from '../../shared/services/workspace.service';
import {OfficialSourcesBrowserComponent} from './official-sources-browser.component';

describe('OfficialSourcesBrowserComponent', () => {
	let fixture: ComponentFixture<OfficialSourcesBrowserComponent>;
	let component: OfficialSourcesBrowserComponent;
	let notifications: NotificationMock;
	let workspaceService: {getAll: jest.Mock};
	let sourceService: {getAll: jest.Mock; getByName: jest.Mock};
	const retraite = aWorkspaceDto({name: 'retraite', sources: ['avs', 'lpp']});
	const general = aWorkspaceDto({id: 2, name: 'GENERAL', description: null, sources: ['avs']});
	const sources = [
		aSourceDto({name: 'avs', description: 'Assurance vieillesse'}),
		aSourceDto({id: 2, name: 'lpp', description: null}),
		aSourceDto({id: 3, name: 'chomage', description: 'Assurance chômage'})
	];
	const element = (): HTMLElement => fixture.nativeElement;
	const text = (selector: string): string[] =>
		Array.from(element().querySelectorAll(selector)).map(node => node.textContent?.replace(/\s+/g, ' ').trim() ?? '');

	function create(): void {
		fixture = TestBed.createComponent(OfficialSourcesBrowserComponent);
		component = fixture.componentInstance;
		refresh(fixture);
	}

	beforeEach(() => {
		notifications = notificationMock();
		workspaceService = {getAll: jest.fn(() => of([retraite, general]))};
		sourceService = {
			getAll: jest.fn(() => of(sources)),
			getByName: jest.fn((name: string) => of(aSourceDto({name, contents: [{title: 'directive-avs.pdf'}, {url: 'https://www.ahv-iv.ch'}]})))
		};
		TestBed.configureTestingModule({
			imports: [OfficialSourcesBrowserComponent],
			providers: [
				provideTranslateService(),
				provideFakeIcons(),
				provideNotificationMock(notifications),
				{provide: WorkspaceService, useValue: workspaceService},
				{provide: SourceService, useValue: sourceService}
			]
		});
	});

	it('met le workspace « Général » en tête, avec les sources rattachées à aucun autre workspace', () => {
		create();

		expect(text('.workspaces-accordion > mat-expansion-panel > mat-expansion-panel-header mat-panel-title')).toEqual(['GENERAL', 'retraite']);
		expect(text('.sources-count')).toEqual(['corpus.workspaces.general.badge', 'corpus.workspaces.sources.count']);
		expect(component.getWorkspaceSourceNames(component.workspaces[0])).toEqual(['avs', 'chomage']);
		expect(component.getWorkspaceSourceNames(component.workspaces[1])).toEqual(['avs', 'lpp']);
		expect(text('.source-name')).toEqual(['sources.avs', 'sources.chomage', 'sources.avs', 'sources.lpp']);
		expect(text('.workspace-description-full')).toEqual(['corpus.workspaces.general.description', 'Prévoyance vieillesse']);
		expect(text('.source-description-full')).toEqual(['Assurance vieillesse', 'Assurance chômage', 'Assurance vieillesse']);
	});

	it('indique un workspace sans source', () => {
		workspaceService.getAll.mockReturnValue(of([aWorkspaceDto({name: 'vide', sources: []})]));
		sourceService.getAll.mockReturnValue(of([]));
		create();

		expect(text('.no-sources')).toEqual(['corpus.workspaces.sources.empty']);
	});

	it('affiche un état vide sans workspace ni source', () => {
		workspaceService.getAll.mockReturnValue(of([]));
		sourceService.getAll.mockReturnValue(of([]));
		create();

		expect(text('.empty-state p')).toEqual(['corpus.workspaces.empty']);
		expect(element().querySelector('.workspaces-accordion')).toBeNull();
	});

	it('affiche le chargement tant que les workspaces ne sont pas reçus', () => {
		const workspaces$ = new Subject<(typeof retraite)[]>();
		workspaceService.getAll.mockReturnValue(workspaces$);
		create();

		expect(element().querySelector('.loading-container')).not.toBeNull();

		workspaces$.next([retraite]);
		workspaces$.complete();
		refresh(fixture);

		expect(element().querySelector('.loading-container')).toBeNull();
		expect(text('.source-name')).toEqual(['sources.avs', 'sources.lpp']);
	});

	it('notifie l’échec du chargement', () => {
		sourceService.getAll.mockReturnValue(throwError(() => new Error('500')));
		create();

		expect(notifications.error).toHaveBeenCalledWith('corpus.workspaces.load.error');
		expect(component.isLoading).toBe(false);
		expect(element().querySelector('.empty-state')).not.toBeNull();
	});

	it('charge les contenus d’une source à son ouverture, une seule fois', async () => {
		create();
		const loader = TestbedHarnessEnvironment.loader(fixture);
		const panel = await loader.getHarness(MatExpansionPanelHarness.with({title: 'retraite'}));
		await panel.expand();
		const sourcePanel = await loader.getHarness(MatExpansionPanelHarness.with({ancestor: '.sources-accordion', title: /sources\.lpp/}));

		await sourcePanel.expand();
		refresh(fixture);

		expect(sourceService.getByName).toHaveBeenCalledWith('lpp');
		expect(text('.contents-list li')).toEqual(['directive-avs.pdf', 'https://www.ahv-iv.ch']);

		await sourcePanel.collapse();
		await sourcePanel.expand();
		expect(sourceService.getByName).toHaveBeenCalledTimes(1);
	});

	it('indique le chargement, puis l’absence de contenus', () => {
		const detail$ = new Subject<SourceDto>();
		sourceService.getByName.mockReturnValue(detail$);
		create();

		component.loadSourceContents('lpp');
		component.loadSourceContents('lpp');
		refresh(fixture);

		expect(sourceService.getByName).toHaveBeenCalledTimes(1);
		expect(component.isLoadingContents('lpp')).toBe(true);
		expect(text('.contents-loading')).toContain('corpus.workspaces.contents.loading');

		detail$.next(aSourceDto({name: 'lpp', contents: []}));
		detail$.complete();
		refresh(fixture);

		expect(component.isLoadingContents('lpp')).toBe(false);
		expect(text('.no-contents')).toEqual(['corpus.workspaces.contents.empty']);
	});

	it('notifie l’échec du chargement des contenus et permet de réessayer', () => {
		sourceService.getByName.mockReturnValueOnce(throwError(() => new Error('500')));
		create();

		component.loadSourceContents('avs');

		expect(notifications.error).toHaveBeenCalledWith('corpus.workspaces.load.error');
		expect(component.getContents('avs')).toBeUndefined();

		component.loadSourceContents('avs');
		expect(component.getContents('avs')?.contents).toHaveLength(2);
	});
});
