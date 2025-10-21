import {Component, ViewChild} from '@angular/core';
import {FeedbackKpiComponent} from './feedback-kpi/feedback-kpi.component';
import {UserAccountsComponent} from './user-accounts/user-accounts.component';
import {AlertsComponent} from './alerts/alerts.component';

@Component({
	selector: 'zco-admin',
	templateUrl: './admin.component.html',
	styleUrl: './admin.component.scss'
})
export class AdminComponent {
	@ViewChild('feedbackKpiComponent') feedbackKpi?: FeedbackKpiComponent;
	@ViewChild('userAccountsComponent') userAccountsComponent?: UserAccountsComponent;
	@ViewChild('alertsComponent') alertComponent?: AlertsComponent;

	onFeedbackPanelOpened() {
		queueMicrotask(() => this.feedbackKpi?.reload());
	}

	onUserPanelOpened() {
		queueMicrotask(() => this.userAccountsComponent?.reload());
	}

	OnAlertPanelOpened() {
		queueMicrotask(() => this.alertComponent?.reload());
	}
}
