// En premier : remplace ng2-charts (cf. testing/admin) avant le chargement du composant.
import {DialogMock, aMessageFeedback, aSourceFeedback, dialogMock, provideDialogMock, provideFakeIcons, refresh} from '../../../testing/admin';
import {TestbedHarnessEnvironment} from '@angular/cdk/testing/testbed';
import {Directive, input} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {MatButtonToggleGroupHarness} from '@angular/material/button-toggle/testing';
import {MatSelectHarness} from '@angular/material/select/testing';
import {By} from '@angular/platform-browser';
import {provideTranslateService} from '@ngx-translate/core';
import {BaseChartDirective} from 'ng2-charts';
import {of, throwError} from 'rxjs';
import {NotificationMock, notificationMock, provideNotificationMock} from '../../../testing/angular';
import {FeedbackStatus, IFeedbackStats, IMessageFeedback, ISourceFeedback} from '../../shared/model/feedback';
import {FeedbackService} from '../../shared/services/feedback.service';
import {DocumentFeedbackDetailDialogComponent} from './document-feedback-detail-dialog/document-feedback-detail-dialog.component';
import {FeedbackDetailDialogComponent} from './feedback-detail-dialog/feedback-detail-dialog.component';
import {FeedbackKpiComponent} from './feedback-kpi.component';
import {FeedbackStatusSelectComponent} from './feedback-status-select/feedback-status-select.component';

/** Graphiques Chart.js remplacés : jsdom n'a pas de canvas. */
@Directive({selector: 'canvas[baseChart]'})
class BaseChartStubDirective {
	readonly data = input<unknown>();
	readonly type = input<string>();
	readonly options = input<unknown>();
}

const stats: IFeedbackStats = {
	total: 10,
	positive: 7,
	negative: 3,
	positiveRate: 0.7,
	perDay: [
		{date: '2026-01-14', positive: 3, negative: 1},
		{date: '2026-01-15', positive: 4, negative: 2}
	],
	byDocument: []
};

describe('FeedbackKpiComponent', () => {
	let fixture: ComponentFixture<FeedbackKpiComponent>;
	let component: FeedbackKpiComponent;
	let notifications: NotificationMock;
	let dialog: DialogMock;
	let feedbackService: {stats: jest.Mock; listMessageFeedback: jest.Mock; listSourceFeedback: jest.Mock; updateMessageFeedbackStatus: jest.Mock};
	let messages: IMessageFeedback[];
	let sources: ISourceFeedback[];
	const element = (): HTMLElement => fixture.nativeElement;
	const tables = (): HTMLTableElement[] => Array.from(element().querySelectorAll<HTMLTableElement>('table'));
	const rows = (table: number): HTMLTableRowElement[] => Array.from(tables()[table].querySelectorAll<HTMLTableRowElement>('tr.mat-mdc-row'));
	const cells = (row: HTMLTableRowElement): string[] => Array.from(row.querySelectorAll('td')).map(cell => cell.textContent?.replace(/\s+/g, ' ').trim() ?? '');
	const charts = (): BaseChartStubDirective[] =>
		fixture.debugElement.queryAll(By.directive(BaseChartStubDirective)).map(debug => debug.injector.get(BaseChartStubDirective));
	const tabCounts = (): string[] => Array.from(element().querySelectorAll('.tab-count')).map(count => count.textContent?.trim() ?? '');
	const settle = async (): Promise<void> => {
		await Promise.resolve();
		refresh(fixture);
	};

	beforeEach(async () => {
		messages = [
			aMessageFeedback({id: 1, timestamp: '2026-01-14T09:00:00', category: 'WRONG_ANSWER', question: 'Q1'}),
			aMessageFeedback({id: 2, timestamp: '2026-01-15T09:00:00', question: 'Q2'}),
			aMessageFeedback({id: 3, timestamp: '2026-01-13T09:00:00', status: 'TREATED', score: 1, category: undefined, question: 'Q3'})
		];
		sources = [
			aSourceFeedback({id: 11, documentId: 'doc-1'}),
			aSourceFeedback({id: 12, documentId: 'doc-1', feedbackType: 'POSITIVE', status: 'TREATED', category: undefined}),
			aSourceFeedback({id: 13, documentId: 'doc-2', documentTitle: undefined, documentUrl: 'https://www.ahv-iv.ch', status: 'OBSOLETE'})
		];
		notifications = notificationMock();
		dialog = dialogMock();
		feedbackService = {
			stats: jest.fn(() => of(stats)),
			listMessageFeedback: jest.fn(() => of(messages)),
			listSourceFeedback: jest.fn(() => of(sources)),
			updateMessageFeedbackStatus: jest.fn((id: number, status: FeedbackStatus) => of(aMessageFeedback({id, status})))
		};
		TestBed.configureTestingModule({
			imports: [FeedbackKpiComponent],
			providers: [
				provideTranslateService(),
				provideFakeIcons(),
				provideNotificationMock(notifications),
				provideDialogMock(dialog),
				{provide: FeedbackService, useValue: feedbackService}
			]
		});
		TestBed.overrideComponent(FeedbackKpiComponent, {remove: {imports: [BaseChartDirective]}, add: {imports: [BaseChartStubDirective]}});
		fixture = TestBed.createComponent(FeedbackKpiComponent);
		component = fixture.componentInstance;
		refresh(fixture);
		await settle();
	});

	it('charge les statistiques de la période et alimente les graphiques', () => {
		expect(feedbackService.stats).toHaveBeenCalledWith('30d');
		expect(feedbackService.listMessageFeedback).toHaveBeenCalledWith('30d');
		expect(feedbackService.listSourceFeedback).toHaveBeenCalledWith('30d');
		expect(Array.from(element().querySelectorAll('.totals .value')).map(value => value.textContent?.trim())).toEqual(['10', '7', '3']);
		expect(element().querySelector('.rate')?.textContent).toContain('70%');
		expect(element().querySelector('.rate')?.classList).toContain('warn');

		const [satisfaction, byStatus, byCategory, timeline] = charts().map(chart => chart.data());
		expect(satisfaction).toEqual({labels: ['👍', '👎'], datasets: [{data: [7, 3]}]});
		expect(byStatus).toEqual({labels: ['feedback.status.NEW', 'feedback.status.TREATED', 'feedback.status.OBSOLETE'], datasets: [{data: [3, 2, 1]}]});
		expect(byCategory).toEqual({
			labels: ['feedback.category.WRONG_SOURCE', 'feedback.category.WRONG_ANSWER', 'feedback.category.INCOMPLETE_ANSWER'],
			datasets: [{data: [2, 1, 1]}]
		});
		expect(timeline).toEqual({
			labels: ['2026-01-14', '2026-01-15'],
			datasets: [
				{label: '👍', data: [3, 4], stack: 's'},
				{label: '👎', data: [1, 2], stack: 's'}
			]
		});
	});

	it('affiche par défaut les nouveaux feedbacks, du plus récent au plus ancien', () => {
		expect(tabCounts()).toEqual(['3', '2', '1', '0']);
		expect(rows(1).map(row => cells(row)[3])).toEqual(['Q2', 'Q1']);
		expect(cells(rows(1)[0]).slice(0, 3)).toEqual(['2026-01-15 09:00', '👎', 'feedback.category.INCOMPLETE_ANSWER']);
		expect(rows(0).map(cells)).toEqual([['directive-avs.pdf', '1', '1', 'feedback.status.NEW 1 feedback.status.TREATED 1', '']]);
	});

	it('filtre par statut', async () => {
		const loader = TestbedHarnessEnvironment.loader(fixture);
		const tabs = (await loader.getAllHarnesses(MatButtonToggleGroupHarness))[1];

		await (await tabs.getToggles({text: /feedback.tab.obsolete/}))[0].check();
		expect(rows(1)).toHaveLength(0);
		expect(element().querySelectorAll('.empty-state')).toHaveLength(1);
		expect(rows(0).map(row => cells(row)[0])).toEqual(['https://www.ahv-iv.ch']);

		await (await tabs.getToggles({text: /feedback.tab.all/}))[0].check();
		expect(rows(1).map(row => cells(row)[3])).toEqual(['Q2', 'Q1', 'Q3']);
		expect(rows(0)).toHaveLength(2);

		component.onStatusTabChange('ALL');
		expect(component.statusFilter).toBe('ALL');
	});

	it('filtre par catégorie, compteurs des onglets compris', async () => {
		const select = await TestbedHarnessEnvironment.loader(fixture).getHarness(MatSelectHarness);

		await select.open();
		await select.clickOptions({text: 'feedback.category.WRONG_ANSWER'});

		expect(tabCounts()).toEqual(['1', '1', '0', '0']);
		expect(rows(1).map(row => cells(row)[3])).toEqual(['Q1']);
		expect(rows(0)).toHaveLength(0);

		component.onCategoryFilterChange('WRONG_SOURCE');
		component.onCategoryFilterChange('WRONG_SOURCE');
		refresh(fixture);
		expect(rows(0).map(row => cells(row).slice(0, 3))).toEqual([['directive-avs.pdf', '1', '0']]);
	});

	it('recharge les données à chaque changement de période', async () => {
		const range = (await TestbedHarnessEnvironment.loader(fixture).getAllHarnesses(MatButtonToggleGroupHarness))[0];

		await (await range.getToggles({text: '7j'}))[0].check();
		expect(feedbackService.stats).toHaveBeenLastCalledWith('7d');

		component.onRangeChange('7d');
		component.reload();
		expect(feedbackService.stats).toHaveBeenCalledTimes(3);
		expect(feedbackService.stats).toHaveBeenLastCalledWith('7d');
	});

	it('change le statut d’un feedback depuis le tableau', () => {
		const select: FeedbackStatusSelectComponent = fixture.debugElement.queryAll(By.directive(FeedbackStatusSelectComponent))[0].componentInstance;

		select.statusChange.emit('TREATED');
		refresh(fixture);

		expect(feedbackService.updateMessageFeedbackStatus).toHaveBeenCalledWith(2, 'TREATED');
		expect(messages[1].status).toBe('TREATED');
		expect(rows(1).map(row => cells(row)[3])).toEqual(['Q1']);
		expect(tabCounts()).toEqual(['3', '1', '2', '0']);
	});

	it('rétablit le statut si la mise à jour échoue', () => {
		feedbackService.updateMessageFeedbackStatus.mockReturnValue(throwError(() => new Error('500')));

		component.onMessageStatusChange(messages[0], 'OBSOLETE');

		expect(messages[0].status).toBe('NEW');
		expect(notifications.error).toHaveBeenCalledWith('admin.feedback.status.error');
	});

	it('ouvre le détail d’un feedback et d’un document', () => {
		rows(1)[0].querySelector<HTMLButtonElement>('td.mat-column-actions button')?.click();
		expect(dialog.open).toHaveBeenCalledWith(FeedbackDetailDialogComponent, expect.objectContaining({data: messages[1]}));

		rows(0)[0].querySelector<HTMLButtonElement>('td.mat-column-actions button')?.click();
		expect(dialog.open).toHaveBeenCalledWith(
			DocumentFeedbackDetailDialogComponent,
			expect.objectContaining({
				data: expect.objectContaining({documentId: 'doc-1', neg: 1, pos: 1, feedbacks: [sources[0], sources[1]]})
			})
		);
	});
});
