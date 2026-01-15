import {Component, OnDestroy, OnInit} from '@angular/core';
import {AlertsService} from '../../services/alert.service';
import {Alert} from '../../model/alerts';
import {Subject, takeUntil} from 'rxjs';
import {TranslateService} from '@ngx-translate/core';

@Component({
	selector: 'zco-alert-banner',
	templateUrl: './alert-banner.component.html',
	styleUrls: ['./alert-banner.component.scss']
})
export class AlertBannerComponent implements OnInit, OnDestroy {
	alerts: Alert[] = [];
	private readonly destroy$ = new Subject<void>();
	private readonly DISMISSED_ALERTS_KEY = 'dismissedAlerts';

	constructor(
		private readonly alertService: AlertsService,
		private readonly translate: TranslateService
	) {}

	ngOnInit(): void {
		this.loadActiveAlerts();
	}

	ngOnDestroy(): void {
		this.destroy$.next();
		this.destroy$.complete();
	}

	loadActiveAlerts(): void {
		this.alertService
			.getActiveAlerts()
			.pipe(takeUntil(this.destroy$))
			.subscribe({
				next: alerts => {
					const dismissedIds = this.getDismissedAlertIds();
					this.alerts = alerts.filter(alert => !dismissedIds.includes(alert.id));
				},
				error: err => {
					console.error('Failed to load active alerts', err);
				}
			});
	}

	getAlertText(alert: Alert): string {
		const currentLang = this.translate.currentLang;
		let text = '';

		switch (currentLang) {
			case 'fr':
				text = alert.textFr || '';
				break;
			case 'de':
				text = alert.textDe || '';
				break;
			case 'it':
				text = alert.textIt || '';
				break;
			default:
				text = alert.textFr || '';
		}

		// Fallback to default translation if no text is provided
		if (!text || text.trim() === 'alert.default.text') {
			text = this.translate.instant('alert.default.text');
		}

		return text;
	}

	dismiss(alert: Alert): void {
		this.alerts = this.alerts.filter(a => a.id !== alert.id);
		this.addDismissedAlertId(alert.id);
	}

	private getDismissedAlertIds(): number[] {
		const stored = sessionStorage.getItem(this.DISMISSED_ALERTS_KEY);
		return stored ? JSON.parse(stored) : [];
	}

	private addDismissedAlertId(id: number): void {
		const dismissed = this.getDismissedAlertIds();
		if (!dismissed.includes(id)) {
			dismissed.push(id);
			sessionStorage.setItem(this.DISMISSED_ALERTS_KEY, JSON.stringify(dismissed));
		}
	}
}
