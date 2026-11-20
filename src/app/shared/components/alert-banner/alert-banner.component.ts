import {ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, inject} from '@angular/core';
import {AlertsService} from '../../services/alert.service';
import {Alert} from '../../model/alerts';
import {Subject, takeUntil} from 'rxjs';
import {TranslatePipe, TranslateService} from '@ngx-translate/core';
import {UserStatus} from '../../model/user';
import {AuthenticationServiceV2} from '../../services/auth.service';
import {NgClass} from '@angular/common';
import {MatIcon} from '@angular/material/icon';
import {MatIconButton} from '@angular/material/button';
import {MatTooltip} from '@angular/material/tooltip';

@Component({
	selector: 'zco-alert-banner',
	templateUrl: './alert-banner.component.html',
	styleUrls: ['./alert-banner.component.scss'],
	changeDetection: ChangeDetectionStrategy.Eager,
	imports: [NgClass, MatIcon, MatIconButton, MatTooltip, TranslatePipe]
})
export class AlertBannerComponent implements OnInit, OnDestroy {
	alerts: Alert[] = [];
	private readonly destroy$ = new Subject<void>();
	private readonly DISMISSED_ALERTS_KEY = 'dismissedAlerts';
	private readonly authService = inject(AuthenticationServiceV2);
	private readonly alertService = inject(AlertsService);
	private readonly translate = inject(TranslateService);
	private readonly cdr = inject(ChangeDetectorRef);

	ngOnInit(): void {
		this.authService.$authenticatedUser.subscribe(user => {
			if (user?.status === UserStatus.ACTIVE) {
				this.loadActiveAlerts();
			}
		});
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
					// Le bandeau peut être hébergé par un composant OnPush (chat).
					this.cdr.markForCheck();
				},
				error: err => {
					console.error('Failed to load active alerts', err);
				}
			});
	}

	getAlertText(alert: Alert): string {
		const currentLang = this.translate.getCurrentLang();
		let text: string;

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
