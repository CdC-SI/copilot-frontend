import {Component, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {FeedbackService, TimeRange} from '../../shared/services/feedback.service';
import {IDocumentFeedbackDetail, IFeedbackStats, IMessageFeedback, ISourceFeedback} from '../../shared/model/feedback';
import {MatTableDataSource} from '@angular/material/table';
import {MatPaginator} from '@angular/material/paginator';
import {MatSort} from '@angular/material/sort';
import {MatDialog} from '@angular/material/dialog';
import {BehaviorSubject, Subject, combineLatest} from 'rxjs';
import {takeUntil} from 'rxjs/operators';
import {FeedbackDetailDialogComponent} from './feedback-detail-dialog/feedback-detail-dialog.component';
import {ChartConfiguration, Chart as ChartJS, registerables} from 'chart.js';
import {DocumentFeedbackDetailDialogComponent} from './document-feedback-detail-dialog/document-feedback-detail-dialog.component';

ChartJS.register(...registerables);

@Component({
	selector: 'zco-feedback-kpi',
	templateUrl: './feedback-kpi.component.html',
	styleUrl: './feedback-kpi.component.scss'
})
export class FeedbackKpiComponent implements OnInit, OnDestroy {
	range: TimeRange = '30d';

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

	// Tables
	latestData = new MatTableDataSource<IMessageFeedback>();
	latestDisplayedColumns = ['timestamp', 'score', 'question', 'comment', 'actions'];

	sourcesData = new MatTableDataSource<IDocumentFeedbackDetail>();
	sourcesDisplayedColumns = ['documentTitle', 'neg', 'pos', 'actions'];

	@ViewChild('latestPaginator') latestPaginator!: MatPaginator;
	@ViewChild('latestSort') latestSort!: MatSort;
	@ViewChild('topSourcesPaginator') sourcesPaginator!: MatPaginator;
	@ViewChild('topSourcesSort') sourcesSort!: MatSort;

	private readonly destroy$ = new Subject<void>();
	private readonly rangeSubject$ = new BehaviorSubject<TimeRange>('30d');

	constructor(
		private readonly feedback: FeedbackService,
		private readonly dialog: MatDialog
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

	openDetail(row: IMessageFeedback) {
		this.dialog.open(FeedbackDetailDialogComponent, {width: '800px', autoFocus: false, panelClass: 'kpi-dialog', data: row});
	}

	openSourceDetail(row: IDocumentFeedbackDetail) {
		this.dialog.open(DocumentFeedbackDetailDialogComponent, {width: '800px', autoFocus: false, panelClass: 'kpi-dialog', data: row});
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
		this.updateCharts(stats);
		this.updateLatestTable(msgs);
		this.updateSourcesTable(srcs);
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
		const map = new Map<string, IDocumentFeedbackDetail>();

		for (const s of sources) {
			const row = map.get(s.documentId) ?? {
				documentId: s.documentId,
				documentTitle: s.documentTitle || s.documentId,
				documentUrl: s.documentUrl,
				neg: 0,
				pos: 0,
				feedbacks: []
			};
			if (s.feedbackType === 'NEGATIVE') row.neg++;
			else row.pos++;
			row.feedbacks.push(s);
			map.set(s.documentId, row);
		}

		this.sourcesData.data = Array.from(map.values());

		queueMicrotask(() => {
			if (this.sourcesPaginator) this.sourcesData.paginator = this.sourcesPaginator;
			if (this.sourcesSort) this.sourcesData.sort = this.sourcesSort;
		});
	}
}
