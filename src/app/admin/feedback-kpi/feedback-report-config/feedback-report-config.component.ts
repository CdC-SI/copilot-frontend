import {ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject} from '@angular/core';
import {FormBuilder, FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators} from '@angular/forms';
import {Subject, takeUntil} from 'rxjs';
import {ObButtonDirective, ObIconButtonDirective, ObMatErrorDirective, ObNotificationService} from '@oblique/oblique';
import {COMMA, ENTER} from '@angular/cdk/keycodes';
import {MatChipEditedEvent, MatChipGrid, MatChipInput, MatChipInputEvent, MatChipRemove, MatChipRow} from '@angular/material/chips';
import {FeedbackService} from '../../../shared/services/feedback.service';
import {FeedbackReportConfig} from '../../../shared/model/feedback';
import {MatCard} from '@angular/material/card';
import {MatIcon} from '@angular/material/icon';
import {MatProgressSpinner} from '@angular/material/progress-spinner';
import {MatSlideToggle} from '@angular/material/slide-toggle';
import {MatError, MatFormField, MatHint, MatLabel} from '@angular/material/form-field';
import {MatInput} from '@angular/material/input';
import {MatButton} from '@angular/material/button';
import {TranslatePipe} from '@ngx-translate/core';

@Component({
	selector: 'zco-feedback-report-config',
	templateUrl: './feedback-report-config.component.html',
	styleUrl: './feedback-report-config.component.scss',
	changeDetection: ChangeDetectionStrategy.Eager,
	imports: [
		MatCard,
		MatIcon,
		MatProgressSpinner,
		FormsModule,
		ReactiveFormsModule,
		MatSlideToggle,
		MatFormField,
		MatLabel,
		MatInput,
		MatHint,
		MatError,
		ObMatErrorDirective,
		MatChipGrid,
		MatChipRow,
		MatChipRemove,
		MatChipInput,
		MatButton,
		ObIconButtonDirective,
		ObButtonDirective,
		TranslatePipe
	]
})
export class FeedbackReportConfigComponent implements OnInit, OnDestroy {
	form!: FormGroup;
	recipients: string[] = [];
	isLoading = false;
	isSaving = false;

	readonly separatorKeysCodes: readonly number[] = [ENTER, COMMA];

	private readonly destroy$ = new Subject<void>();
	private readonly fb = inject(FormBuilder);
	private readonly feedbackService = inject(FeedbackService);
	private readonly notif = inject(ObNotificationService);

	ngOnInit(): void {
		this.form = this.fb.group({
			enabled: [false],
			cronExpression: ['', Validators.required],
			zoneId: ['', Validators.required],
			recipients: [[] as string[], Validators.required],
			lookbackDays: [7, [Validators.required, Validators.min(1)]]
		});
		this.reload();
	}

	ngOnDestroy(): void {
		this.destroy$.next();
		this.destroy$.complete();
	}

	get recipientsCtrl(): FormControl {
		return this.form.get('recipients') as FormControl;
	}

	reload(): void {
		this.isLoading = true;
		this.feedbackService
			.getReportConfig()
			.pipe(takeUntil(this.destroy$))
			.subscribe({
				next: config => {
					this.recipients = [...config.recipients];
					this.form.patchValue(config);
					this.isLoading = false;
				},
				error: () => {
					this.isLoading = false;
					this.notif.error('admin.feedbackReport.load.error');
				}
			});
	}

	addRecipient(event: MatChipInputEvent): void {
		const value = (event.value || '').trim();
		if (value) {
			this.recipients.push(value);
		}
		event.chipInput?.clear();
		this.recipientsCtrl.setValue(this.recipients);
		this.recipientsCtrl.markAsDirty();
	}

	removeRecipient(recipient: string): void {
		const index = this.recipients.indexOf(recipient);
		if (index >= 0) {
			this.recipients.splice(index, 1);
		}
		this.recipientsCtrl.setValue(this.recipients);
		this.recipientsCtrl.markAsDirty();
	}

	editRecipient(recipient: string, event: MatChipEditedEvent): void {
		const value = event.value.trim();
		if (!value) {
			this.removeRecipient(recipient);
			return;
		}
		const index = this.recipients.indexOf(recipient);
		if (index >= 0) {
			this.recipients[index] = value;
		}
		this.recipientsCtrl.setValue(this.recipients);
	}

	save(): void {
		if (this.form.invalid || this.recipients.length === 0) {
			this.form.markAllAsTouched();
			return;
		}
		this.isSaving = true;
		const reportConfig: FeedbackReportConfig = {...this.form.value, recipients: this.recipients};
		this.feedbackService
			.updateReportConfig(reportConfig)
			.pipe(takeUntil(this.destroy$))
			.subscribe({
				next: updated => {
					this.recipients = [...updated.recipients];
					this.form.patchValue(updated);
					this.isSaving = false;
					this.notif.success('admin.feedbackReport.save.success');
				},
				error: () => {
					this.isSaving = false;
					this.notif.error('admin.feedbackReport.save.error');
				}
			});
	}
}
