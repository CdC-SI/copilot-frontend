import {Component, OnDestroy, OnInit} from '@angular/core';
import {AbstractControl, FormBuilder, FormGroup, ValidationErrors, Validators} from '@angular/forms';
import {Subject, takeUntil} from 'rxjs';
import {ObNotificationService} from '@oblique/oblique';
import {RetentionConfigService} from '../../shared/services/retention-config.service';
import {DocumentRetentionConfig} from '../../shared/model/document-retention-config';

@Component({
	selector: 'zco-retention-config',
	templateUrl: './retention-config.component.html',
	styleUrl: './retention-config.component.scss'
})
export class RetentionConfigComponent implements OnInit, OnDestroy {
	form!: FormGroup;
	isLoading = false;
	isSaving = false;

	private readonly destroy$ = new Subject<void>();

	constructor(
		private readonly fb: FormBuilder,
		private readonly retentionConfigService: RetentionConfigService,
		private readonly notif: ObNotificationService
	) {}

	ngOnInit(): void {
		this.form = this.fb.group(
			{
				daysBeforeArchival: [null, [Validators.required, Validators.min(1)]],
				daysBeforeDeletion: [null, [Validators.required, Validators.min(1)]]
			},
			{validators: archivalBeforeDeletionValidator}
		);
		this.reload();
	}

	ngOnDestroy(): void {
		this.destroy$.next();
		this.destroy$.complete();
	}

	reload(): void {
		this.isLoading = true;
		this.retentionConfigService
			.get()
			.pipe(takeUntil(this.destroy$))
			.subscribe({
				next: config => {
					this.form.patchValue(config);
					this.isLoading = false;
				},
				error: () => {
					this.isLoading = false;
					this.notif.error('admin.retention.load.error');
				}
			});
	}

	save(): void {
		if (this.form.invalid) {
			this.form.markAllAsTouched();
			return;
		}
		this.isSaving = true;
		const config: DocumentRetentionConfig = this.form.value;
		this.retentionConfigService
			.update(config)
			.pipe(takeUntil(this.destroy$))
			.subscribe({
				next: updated => {
					this.form.patchValue(updated);
					this.isSaving = false;
					this.notif.success('admin.retention.save.success');
				},
				error: () => {
					this.isSaving = false;
					this.notif.error('admin.retention.save.error');
				}
			});
	}
}

function archivalBeforeDeletionValidator(group: AbstractControl): ValidationErrors | null {
	const archival = group.get('daysBeforeArchival')?.value;
	const deletion = group.get('daysBeforeDeletion')?.value;
	if (archival == null || deletion == null) {
		return null;
	}
	return archival < deletion ? null : {archivalNotBeforeDeletion: true};
}
