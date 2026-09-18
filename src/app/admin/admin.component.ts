import {Component, OnInit, ViewChild} from '@angular/core';
import {MatExpansionPanel} from '@angular/material/expansion';
import {FeedbackKpiComponent} from './feedback-kpi/feedback-kpi.component';
import {UserAccountsComponent} from './user-accounts/user-accounts.component';
import {AlertsComponent} from './alerts/alerts.component';
import {SourcesComponent} from './sources/sources.component';
import {WorkspacesComponent} from './workspaces/workspaces.component';
import {RetentionConfigComponent} from './retention-config/retention-config.component';
import {FeedbackService} from '../shared/services/feedback.service';
import {FeedbackReportConfigComponent} from './feedback-kpi/feedback-report-config/feedback-report-config.component';

@Component({
	selector: 'zco-admin',
	templateUrl: './admin.component.html',
	styleUrl: './admin.component.scss'
})
export class AdminComponent implements OnInit {
	@ViewChild('feedbackKpiComponent') feedbackKpi?: FeedbackKpiComponent;
	@ViewChild('userAccountsComponent') userAccountsComponent?: UserAccountsComponent;
	@ViewChild('alertsComponent') alertComponent?: AlertsComponent;
	@ViewChild('sourcesComponent') sourcesComponent?: SourcesComponent;
	@ViewChild('workspacesComponent') workspacesComponent?: WorkspacesComponent;
	@ViewChild('retentionConfigComponent') retentionConfigComponent?: RetentionConfigComponent;
	@ViewChild('feedbackReportConfigComponent') feedbackReportConfigComponent?: FeedbackReportConfigComponent;
	@ViewChild('sourcesPanel') sourcesPanel?: MatExpansionPanel;

	readonly newFeedbackCount$ = this.feedbackService.newFeedbackCount$;

	constructor(private readonly feedbackService: FeedbackService) {}

	ngOnInit(): void {
		this.feedbackService.refreshNewFeedbackCount();
	}

	onFeedbackPanelOpened() {
		queueMicrotask(() => this.feedbackKpi?.reload());
	}

	onFeedbackReportPanelOpened() {
		queueMicrotask(() => this.feedbackReportConfigComponent?.reload());
	}

	onUserPanelOpened() {
		queueMicrotask(() => this.userAccountsComponent?.reload());
	}

	OnAlertPanelOpened() {
		queueMicrotask(() => this.alertComponent?.reload());
	}

	onSourcesPanelOpened() {
		queueMicrotask(() => this.sourcesComponent?.reload());
	}

	onWorkspacesPanelOpened() {
		queueMicrotask(() => this.workspacesComponent?.reload());
	}

	onRetentionPanelOpened() {
		queueMicrotask(() => this.retentionConfigComponent?.reload());
	}

	/** Ouvre le panneau Sources et met en évidence la source sélectionnée depuis le détail d'un workspace. */
	onWorkspaceSourceSelected(name: string) {
		this.sourcesPanel?.open();
		queueMicrotask(() => this.sourcesComponent?.expandSourceByName(name));
	}
}
