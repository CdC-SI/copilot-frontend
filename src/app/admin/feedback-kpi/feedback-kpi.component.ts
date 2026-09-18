import {Component, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {FeedbackService, TimeRange} from '../../shared/services/feedback.service';
import {
	FEEDBACK_STATUSES,
	FeedbackCategory,
	FeedbackStatus,
	IDocumentFeedbackDetail,
	IFeedbackStats,
	IMessageFeedback,
	ISourceFeedback
} from '../../shared/model/feedback';
import {MatTableDataSource} from '@angular/material/table';
import {MatPaginator} from '@angular/material/paginator';
import {MatSort} from '@angular/material/sort';
import {MatDialog} from '@angular/material/dialog';
import {BehaviorSubject, Subject, combineLatest} from 'rxjs';
import {takeUntil} from 'rxjs/operators';
import {FeedbackDetailDialogComponent} from './feedback-detail-dialog/feedback-detail-dialog.component';
import {ChartConfiguration, Chart as ChartJS, registerables} from 'chart.js';
import {DocumentFeedbackDetailDialogComponent} from './document-feedback-detail-dialog/document-feedback-detail-dialog.component';
import {ObNotificationService} from '@oblique/oblique';
import {TranslateService} from '@ngx-translate/core';

ChartJS.register(...registerables);

export type StatusTab = 'ALL' | FeedbackStatus;
export type CategoryFilter = 'ALL' | FeedbackCategory;

const ALL_CATEGORIES: FeedbackCategory[] = ['WRONG_SOURCE', 'WRONG_ANSWER', 'INCOMPLETE_ANSWER'];

@Component({
	selector: 'zco-feedback-kpi',
	templateUrl: './feedback-kpi.component.html',
	styleUrl: './feedback-kpi.component.scss'
})
export class FeedbackKpiComponent implements OnInit, OnDestroy {
	range: TimeRange = '30d';

	// Status/category filters, shared by both tables
	readonly statusTabs: StatusTab[] = ['ALL', ...FEEDBACK_STATUSES];
	readonly categoryOptions: FeedbackCategory[] = ALL_CATEGORIES;
	statusFilter: StatusTab = 'NEW';
	categoryFilter: CategoryFilter = 'ALL';
	statusCounts: Record<StatusTab, number> = {ALL: 0, NEW: 0, TREATED: 0, OBSOLETE: 0};

	// KPI cards
	stats?: IFeedbackStats;

	// Charts
	doughnutData?: ChartConfiguration<'doughnut'>['data'];
	doughnutOpts: ChartConfiguration<'doughnut'>['options'] = {responsive: true, maintainAspectRatio: false, plugins: {legend: {position: 'bottom'}}};

	barData?: ChartConfiguration<'bar'>['data'];
	barOpts: ChartConfiguration<'bar'>['options'] = {
		responsive: true,
		maintainAspectRatio: false,
		scales: {x: {}, y: {stacked: true}},
		plugins: {legend: {position: 'bottom'}}
	};

	statusDoughnutData?: ChartConfiguration<'doughnut'>['data'];
	categoryDoughnutData?: ChartConfiguration<'doughnut'>['data'];

	// Tables
	latestData = new MatTableDataSource<IMessageFeedback>();
	latestDisplayedColumns = ['timestamp', 'score', 'category', 'question', 'comment', 'status', 'actions'];

	sourcesData = new MatTableDataSource<IDocumentFeedbackDetail>();
	sourcesDisplayedColumns = ['documentTitle', 'neg', 'pos', 'statuses', 'actions'];

	@ViewChild('latestPaginator') latestPaginator!: MatPaginator;
	@ViewChild('latestSort') latestSort!: MatSort;
	@ViewChild('topSourcesPaginator') sourcesPaginator!: MatPaginator;
	@ViewChild('topSourcesSort') sourcesSort!: MatSort;

	private readonly destroy$ = new Subject<void>();
	private readonly rangeSubject$ = new BehaviorSubject<TimeRange>('30d');

	// Unfiltered data for the selected range, used to compute filters/breakdowns client-side
	private rawMessages: IMessageFeedback[] = [];
	private rawSources: ISourceFeedback[] = [];

	constructor(
		private readonly feedback: FeedbackService,
		private readonly dialog: MatDialog,
		private readonly notif: ObNotificationService,
		private readonly translate: TranslateService
	) {}

	ngOnInit(): void {
		this.rangeSubject$.pipe(takeUntil(this.destroy$)).subscribe(range => {
			this.range = range;
			this.fetchData(range);
		});
	}

	ngOnDestroy(): void {
		this.destroy$.next();
		this.destroy$.complete();
	}

	onRangeChange(r: TimeRange) {
		if (this.range !== r) {
			this.rangeSubject$.next(r);
		}
	}

	onStatusTabChange(status: StatusTab): void {
		if (this.statusFilter === status) return;
		this.statusFilter = status;
		this.applyFilters();
	}

	onCategoryFilterChange(category: CategoryFilter): void {
		if (this.categoryFilter === category) return;
		this.categoryFilter = category;
		this.applyFilters();
	}

	openDetail(row: IMessageFeedback) {
		this.dialog
			.open(FeedbackDetailDialogComponent, {width: '800px', autoFocus: false, panelClass: 'kpi-dialog', data: row})
			.afterClosed()
			.subscribe(() => this.applyFilters());
	}

	openSourceDetail(row: IDocumentFeedbackDetail) {
		this.dialog
			.open(DocumentFeedbackDetailDialogComponent, {width: '800px', autoFocus: false, panelClass: 'kpi-dialog', data: row})
			.afterClosed()
			.subscribe(() => this.applyFilters());
	}

	onMessageStatusChange(row: IMessageFeedback, status: FeedbackStatus): void {
		const previous = row.status;
		row.status = status; // optimistic update (row is the same object reference held in rawMessages)
		this.feedback.updateMessageFeedbackStatus(row.id, status).subscribe({
			next: updated => {
				row.status = updated.status;
				this.applyFilters();
			},
			error: () => {
				row.status = previous;
				this.notif.error('admin.feedback.status.error');
			}
		});
	}

	reload(): void {
		this.rangeSubject$.next(this.range);
	}

	private fetchData(range: TimeRange): void {
		const stats$ = this.feedback.stats(range);
		const messages$ = this.feedback.listMessageFeedback(range);
		const sources$ = this.feedback.listSourceFeedback(range);

		combineLatest([stats$, messages$, sources$])
			.pipe(takeUntil(this.destroy$))
			.subscribe(([stats, messages, sources]) => this.updateView(stats, messages, sources));
	}

	private updateView(stats: IFeedbackStats, msgs: IMessageFeedback[], srcs: ISourceFeedback[]): void {
		this.stats = stats;
		this.rawMessages = msgs;
		this.rawSources = srcs;
		this.updateCharts(stats);
		this.applyFilters();
	}

	private updateCharts(stats: IFeedbackStats): void {
		this.doughnutData = {
			labels: ['👍', '👎'],
			datasets: [{data: [stats.positive, stats.negative]}]
		};

		const labels = stats.perDay.map(d => d.date);
		const pos = stats.perDay.map(d => d.positive);
		const neg = stats.perDay.map(d => d.negative);

		this.barData = {
			labels,
			datasets: [
				{label: '👍', data: pos, stack: 's'},
				{label: '👎', data: neg, stack: 's'}
			]
		};
	}

	private updateBreakdownCharts(): void {
		const statusData = FEEDBACK_STATUSES.map(s => this.rawMessages.filter(m => m.status === s).length + this.rawSources.filter(sr => sr.status === s).length);
		this.statusDoughnutData = {
			labels: FEEDBACK_STATUSES.map(s => this.translate.instant(`feedback.status.${s}`)),
			datasets: [{data: statusData}]
		};

		const categoryData = ALL_CATEGORIES.map(
			c => this.rawMessages.filter(m => m.category === c).length + this.rawSources.filter(sr => sr.category === c).length
		);
		this.categoryDoughnutData = {
			labels: ALL_CATEGORIES.map(c => this.translate.instant(`feedback.category.${c}`)),
			datasets: [{data: categoryData}]
		};
	}

	private updateStatusCounts(): void {
		const matchesCategory = (item: {category?: FeedbackCategory}) => this.categoryFilter === 'ALL' || item.category === this.categoryFilter;
		const messages = this.rawMessages.filter(matchesCategory);
		const counts: Record<StatusTab, number> = {ALL: messages.length, NEW: 0, TREATED: 0, OBSOLETE: 0};
		for (const m of messages) counts[m.status]++;
		this.statusCounts = counts;
	}

	private applyFilters(): void {
		this.updateBreakdownCharts();
		this.updateStatusCounts();

		const matches = (item: {status: FeedbackStatus; category?: FeedbackCategory}) =>
			(this.statusFilter === 'ALL' || item.status === this.statusFilter) && (this.categoryFilter === 'ALL' || item.category === this.categoryFilter);

		this.updateLatestTable(this.rawMessages.filter(matches));
		this.updateSourcesTable(this.rawSources);
	}

	private updateLatestTable(msgs: IMessageFeedback[]): void {
		this.latestData.data = (msgs as any).toSorted ? (msgs as any).toSorted(this.sortByTimestampDesc) : [...msgs].sort(this.sortByTimestampDesc);

		// brancher paginator/sort après rendu
		queueMicrotask(() => {
			if (this.latestPaginator) this.latestData.paginator = this.latestPaginator;
			if (this.latestSort) this.latestData.sort = this.latestSort;
		});
	}
	private readonly sortByTimestampDesc = (a: {timestamp: string}, b: {timestamp: string}) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();

	private updateSourcesTable(sources: ISourceFeedback[]): void {
		// Only the category filter narrows down which feedback entries count in a document's badges;
		// the status tab decides which documents are shown (must have at least one matching entry).
		const categoryFiltered = sources.filter(s => this.categoryFilter === 'ALL' || s.category === this.categoryFilter);

		const map = new Map<string, IDocumentFeedbackDetail>();

		for (const s of categoryFiltered) {
			const row = map.get(s.documentId) ?? {
				documentId: s.documentId,
				documentTitle: s.documentTitle || s.documentId,
				documentUrl: s.documentUrl,
				neg: 0,
				pos: 0,
				statusCounts: {NEW: 0, TREATED: 0, OBSOLETE: 0},
				feedbacks: []
			};
			if (s.feedbackType === 'NEGATIVE') row.neg++;
			else row.pos++;
			row.statusCounts[s.status]++;
			row.feedbacks.push(s);
			map.set(s.documentId, row);
		}

		const rows = Array.from(map.values()).filter(row => this.statusFilter === 'ALL' || row.statusCounts[this.statusFilter as FeedbackStatus] > 0);

		this.sourcesData.data = rows;

		queueMicrotask(() => {
			if (this.sourcesPaginator) this.sourcesData.paginator = this.sourcesPaginator;
			if (this.sourcesSort) this.sourcesData.sort = this.sourcesSort;
		});
	}
}
