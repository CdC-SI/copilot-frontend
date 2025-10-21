import {ChangeDetectorRef, Component, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {FormBuilder, FormGroup, Validators} from '@angular/forms';
import {MatTableDataSource} from '@angular/material/table';
import {MatPaginator} from '@angular/material/paginator';
import {MatSort} from '@angular/material/sort';
import {Subject, takeUntil} from 'rxjs';
import {AlertsService, toLocalDateTimeString} from '../../shared/services/alert.service';
import {AlertLevel, AlertView, CreateAlertDTO} from '../../shared/model/alerts';
import {ObNotificationService} from '@oblique/oblique';
import {join} from '@angular/compiler-cli';
import {LangChangeEvent, TranslateService} from '@ngx-translate/core';
import {MatDialog} from '@angular/material/dialog';
import {ReactivateDialogComponent} from './reactivate-dialog/reactivate-dialog.component';

@Component({
	selector: 'zco-admin-alerts',
	templateUrl: './alerts.component.html',
	styleUrl: './alerts.component.scss'
})
export class AlertsComponent implements OnInit, OnDestroy {
	form!: FormGroup;
	levels: AlertLevel[] = ['INFO', 'WARNING'];

	activeData = new MatTableDataSource<AlertView>([]);
	expiredData = new MatTableDataSource<AlertView>([]);

	displayedColumns = ['level', 'message', 'expires', 'actions'];
	@ViewChild('activePaginator') activePaginator!: MatPaginator;
	@ViewChild('activeSort') activeSort!: MatSort;
	@ViewChild('expiredPaginator') expiredPaginator!: MatPaginator;

	@ViewChild('expiredSort') expiredSort!: MatSort;
	private readonly destroy$ = new Subject<void>();

	constructor(
		private readonly fb: FormBuilder,
		private readonly alertService: AlertsService,
		private readonly notif: ObNotificationService,
		private readonly translate: TranslateService,
		private readonly cdr: ChangeDetectorRef,
		private readonly dialog: MatDialog
	) {}

	ngOnInit(): void {
		this.form = this.fb.group({
			level: ['INFO', Validators.required],
			textFr: [''],
			textDe: [''],
			textIt: [''],
			date: [null],
			time: ['', [Validators.pattern(/^([01]\d|2[0-3]):([0-5]\d)$/)]] // HH:mm
		});
		this.reload();
		this.translate.onLangChange.pipe(takeUntil(this.destroy$)).subscribe((_e: LangChangeEvent) => {
			this.cdr.markForCheck();
		});
	}

	ngOnDestroy(): void {
		this.destroy$.next();
		this.destroy$.complete();
	}

	allTextEmpty(): boolean {
		const v = this.form.value;
		return !((v.textFr ?? '').trim() || (v.textDe ?? '').trim() || (v.textIt ?? '').trim());
	}

	reload(): void {
		this.alertService
			.getAlerts()
			.pipe(takeUntil(this.destroy$))
			.subscribe({
				next: list => {
					this.activeData.data = list.filter(a => a.active);
					this.expiredData.data = list.filter(a => !a.active);
					queueMicrotask(() => {
						if (this.activePaginator) this.activeData.paginator = this.activePaginator;
						if (this.activeSort) this.activeData.sort = this.activeSort;
						if (this.expiredPaginator) this.expiredData.paginator = this.expiredPaginator;
						if (this.expiredSort) this.expiredData.sort = this.expiredSort;
					});
				},
				error: () => this.notif.error('admin.alerts.load.error')
			});
	}

	create(): void {
		if (this.form.invalid) return;
		const v = this.form.value;
		const expiresAt = buildLocalDateTime(v.date, v.time); // string | null
		const dto: CreateAlertDTO = {
			level: v.level,
			textFr: emptyToNull(v.textFr),
			textDe: emptyToNull(v.textDe),
			textIt: emptyToNull(v.textIt),
			expiresAt
		};
		this.alertService.createAlert(dto).subscribe({
			next: () => {
				this.notif.success('admin.alerts.create.success');
				this.form.reset({level: 'INFO', textFr: '', textDe: '', textIt: '', date: null, time: ''});
				this.reload();
			},
			error: () => this.notif.error('admin.alerts.create.error')
		});
	}

	/** Réactiver une alerte expirée : PUT /alerts/{id} avec une nouvelle date future */
	reactivate(row: AlertView): void {
		const dialogRef = this.dialog.open(ReactivateDialogComponent, {
			width: '500px',
			data: {current: row.expiresAt}
		});

		dialogRef.afterClosed().subscribe(iso => {
			if (!iso) return; // cancel
			this.alertService.setExpiration(row.id, iso).subscribe({
				next: () => {
					this.notif.success('admin.alerts.reactivate.success');
					this.reload();
				},
				error: () => this.notif.error('admin.alerts.reactivate.error')
			});
		});
	}

	/** Supprimer définitivement : DELETE /alerts/{id} */
	delete(row: AlertView): void {
		this.alertService.deleteAlert(row.id).subscribe({
			next: () => {
				this.notif.success('admin.alerts.delete.success');
				this.reload();
			},
			error: () => this.notif.error('admin.alerts.delete.error')
		});
	}

	currentText(a: {textFr?: string | null; textDe?: string | null; textIt?: string | null}): string {
		const lang = this.baseLang();
		const raw = lang === 'fr' ? a.textFr || '' : lang === 'de' ? a.textDe || '' : a.textIt || '';

		const trimmed = raw.trim();
		return trimmed || this.translate.instant('alert.default.text');
	}

	// --- helpers langue/texte ---
	private baseLang(): 'fr' | 'de' | 'it' {
		const l = (this.translate.currentLang || '').toLowerCase();
		if (l.startsWith('fr')) return 'fr';
		if (l.startsWith('de')) return 'de';
		if (l.startsWith('it')) return 'it';
		// fallback par défaut (à ajuster si besoin)
		return 'fr';
	}
}

function emptyToNull(s?: string | null) {
	const t = (s ?? '').trim();
	return t.length ? t : null;
}

function buildLocalDateTime(dateObj: Date | null, timeStr?: string): string | null {
	if (!dateObj) return null;
	const d = new Date(dateObj);
	if (timeStr && /^\d{2}:\d{2}$/.test(timeStr)) {
		const [hh, mm] = timeStr.split(':').map(Number);
		d.setHours(hh, mm, 0, 0);
	} else {
		d.setHours(23, 59, 0, 0);
	}
	return toLocalDateTimeString(d);
}
