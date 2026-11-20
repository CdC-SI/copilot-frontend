import {ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, ViewChild, inject} from '@angular/core';
import {FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators} from '@angular/forms';
import {
	MatCell,
	MatCellDef,
	MatColumnDef,
	MatHeaderCell,
	MatHeaderCellDef,
	MatHeaderRow,
	MatHeaderRowDef,
	MatRow,
	MatRowDef,
	MatTable,
	MatTableDataSource
} from '@angular/material/table';
import {MatPaginator} from '@angular/material/paginator';
import {MatSort} from '@angular/material/sort';
import {Subject, takeUntil} from 'rxjs';
import {AlertsService, toLocalDateTimeString} from '../../shared/services/alert.service';
import {AlertLevel, AlertView, CreateAlertDTO} from '../../shared/model/alerts';
import {ObButtonDirective, ObIconButtonDirective, ObNotificationService} from '@oblique/oblique';
import {LangChangeEvent, TranslatePipe, TranslateService} from '@ngx-translate/core';
import {MatDialog} from '@angular/material/dialog';
import {ReactivateDialogComponent} from './reactivate-dialog/reactivate-dialog.component';
import {MatCard, MatCardContent, MatCardTitle} from '@angular/material/card';
import {MatFormField, MatHint, MatLabel, MatSuffix} from '@angular/material/form-field';
import {MatSelect} from '@angular/material/select';
import {MatOption} from '@angular/material/core';
import {MatInput} from '@angular/material/input';
import {MatDatepicker, MatDatepickerInput, MatDatepickerToggle} from '@angular/material/datepicker';
import {MatAccordion, MatExpansionPanel, MatExpansionPanelDescription, MatExpansionPanelHeader, MatExpansionPanelTitle} from '@angular/material/expansion';
import {MatButton, MatIconButton} from '@angular/material/button';
import {MatChip, MatChipSet} from '@angular/material/chips';
import {MatIcon} from '@angular/material/icon';
import {MatTooltip} from '@angular/material/tooltip';
import {DatePipe} from '@angular/common';

@Component({
	selector: 'zco-admin-alerts',
	templateUrl: './alerts.component.html',
	styleUrl: './alerts.component.scss',
	changeDetection: ChangeDetectionStrategy.Eager,
	imports: [
		MatCard,
		MatCardTitle,
		MatCardContent,
		FormsModule,
		ReactiveFormsModule,
		MatFormField,
		MatLabel,
		MatSelect,
		MatOption,
		MatInput,
		MatDatepickerInput,
		MatDatepickerToggle,
		MatSuffix,
		MatDatepicker,
		MatHint,
		MatAccordion,
		MatExpansionPanel,
		MatExpansionPanelHeader,
		MatExpansionPanelTitle,
		MatExpansionPanelDescription,
		MatButton,
		ObIconButtonDirective,
		ObButtonDirective,
		MatTable,
		MatSort,
		MatColumnDef,
		MatHeaderCellDef,
		MatHeaderCell,
		MatCellDef,
		MatCell,
		MatChipSet,
		MatChip,
		MatIconButton,
		MatIcon,
		MatTooltip,
		MatHeaderRowDef,
		MatHeaderRow,
		MatRowDef,
		MatRow,
		MatPaginator,
		DatePipe,
		TranslatePipe
	]
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
	private readonly fb = inject(FormBuilder);
	private readonly alertService = inject(AlertsService);
	private readonly notif = inject(ObNotificationService);
	private readonly translate = inject(TranslateService);
	private readonly cdr = inject(ChangeDetectorRef);
	private readonly dialog = inject(MatDialog);

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
		const l = (this.translate.getCurrentLang() || '').toLowerCase();
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
