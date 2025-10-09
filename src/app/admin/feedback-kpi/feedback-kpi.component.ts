import {Component, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {FeedbackService, TimeRange} from '../../shared/services/feedback.service';
import {IDocumentFeedbackDetail, IFeedbackStats, IMessageFeedback} from '../../shared/model/feedback';
import {MatTableDataSource} from '@angular/material/table';
import {MatPaginator} from '@angular/material/paginator';
import {MatSort} from '@angular/material/sort';
import {MatDialog} from '@angular/material/dialog';
import {Subject, combineLatest} from 'rxjs';
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

	constructor(
		private readonly feedback: FeedbackService,
		private readonly dialog: MatDialog
	) {}

	ngOnInit(): void {
		this.refresh();
	}

	ngOnDestroy(): void {
		this.destroy$.next();
		this.destroy$.complete();
	}

	onRangeChange(r: TimeRange) {
		if (this.range !== r) {
			this.range = r;
			this.refresh();
		}
	}

	openDetail(row: IMessageFeedback) {
		this.dialog.open(FeedbackDetailDialogComponent, {width: '800px', autoFocus: false, panelClass: 'kpi-dialog', data: row});
	}

	openSourceDetail(row: IDocumentFeedbackDetail) {
		this.dialog.open(DocumentFeedbackDetailDialogComponent, {width: '800px', autoFocus: false, panelClass: 'kpi-dialog', data: row});
	}

	reload(): void {
		this.refresh();
	}

	private refresh() {
		const stats$ = this.feedback.stats(this.range);
		const msgs$ = this.feedback.listMessageFeedback(this.range);
		const srcs$ = this.feedback.listSourceFeedback(this.range);

		combineLatest([stats$, msgs$, srcs$])
			.pipe(takeUntil(this.destroy$))
			.subscribe(([stats, msgs, srcs]) => {
				this.stats = stats;

				// charts
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

				// tables
				this.latestData.data = msgs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
				setTimeout(() => {
					// wire after view
					if (this.latestPaginator) this.latestData.paginator = this.latestPaginator;
					if (this.latestSort) this.latestData.sort = this.latestSort;
				});

				// Aggregate source stats into a flattened list for the table
				const docMap = new Map<string, IDocumentFeedbackDetail>();
				srcs.forEach(s => {
					const key = s.documentId;
					const e = docMap.get(key) || {
						documentId: key,
						documentTitle: s.documentTitle,
						documentUrl: s.documentUrl,
						neg: 0,
						pos: 0,
						feedbacks: []
					};
					if (s.feedbackType === 'NEGATIVE') e.neg++;
					else e.pos++;
					e.feedbacks.push(s);
					docMap.set(key, e);
				});
				this.sourcesData.data = Array.from(docMap.values());
				setTimeout(() => {
					// wire after view
					if (this.sourcesPaginator) this.sourcesData.paginator = this.sourcesPaginator;
					if (this.sourcesSort) this.sourcesData.sort = this.sourcesSort;
				});
			});
	}
}
