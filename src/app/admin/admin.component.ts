import {ChangeDetectionStrategy, Component, Injector, OnInit, ViewChild, afterNextRender, inject} from '@angular/core';
import {
	MatAccordion,
	MatExpansionPanel,
	MatExpansionPanelContent,
	MatExpansionPanelDescription,
	MatExpansionPanelHeader,
	MatExpansionPanelTitle
} from '@angular/material/expansion';
import {FeedbackKpiComponent} from './feedback-kpi/feedback-kpi.component';
import {UserAccountsComponent} from './user-accounts/user-accounts.component';
import {AlertsComponent} from './alerts/alerts.component';
import {SourcesComponent} from './sources/sources.component';
import {WorkspacesComponent} from './workspaces/workspaces.component';
import {RetentionConfigComponent} from './retention-config/retention-config.component';
import {FeedbackService} from '../shared/services/feedback.service';
import {FeedbackReportConfigComponent} from './feedback-kpi/feedback-report-config/feedback-report-config.component';
import {FaqEditComponent} from './faq-edit/faq-edit.component';
import {DocUploadComponent} from './doc-upload/doc-upload.component';
import {AsyncPipe} from '@angular/common';
import {TranslatePipe} from '@ngx-translate/core';

@Component({
	selector: 'zco-admin',
	templateUrl: './admin.component.html',
	styleUrl: './admin.component.scss',
	changeDetection: ChangeDetectionStrategy.Eager,
	imports: [
		MatAccordion,
		MatExpansionPanel,
		MatExpansionPanelHeader,
		MatExpansionPanelTitle,
		MatExpansionPanelDescription,
		MatExpansionPanelContent,
		UserAccountsComponent,
		FeedbackKpiComponent,
		FeedbackReportConfigComponent,
		AlertsComponent,
		FaqEditComponent,
		DocUploadComponent,
		RetentionConfigComponent,
		SourcesComponent,
		WorkspacesComponent,
		AsyncPipe,
		TranslatePipe
	]
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

	readonly newFeedbackCount$ = inject(FeedbackService).newFeedbackCount$;
	private readonly feedbackService = inject(FeedbackService);
	private readonly injector = inject(Injector);

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
		// Après le rendu : au premier dépliage, le contenu paresseux du panneau (et donc sourcesComponent) n'existe pas encore.
		afterNextRender(() => this.sourcesComponent?.expandSourceByName(name), {injector: this.injector});
	}
}
