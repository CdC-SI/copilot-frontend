import {ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject} from '@angular/core';
import {FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators} from '@angular/forms';
import {Subject, takeUntil} from 'rxjs';
import {ObButtonDirective, ObIconButtonDirective, ObMatErrorDirective, ObNotificationService} from '@oblique/oblique';
import {RetentionConfigService} from '../../shared/services/retention-config.service';
import {DocumentRetentionConfig} from '../../shared/model/document-retention-config';
import {MatCard} from '@angular/material/card';
import {MatIcon} from '@angular/material/icon';
import {MatProgressSpinner} from '@angular/material/progress-spinner';
import {MatError, MatFormField, MatHint, MatLabel, MatSuffix} from '@angular/material/form-field';
import {MatInput} from '@angular/material/input';
import {MatButton} from '@angular/material/button';
import {TranslatePipe} from '@ngx-translate/core';

@Component({
	selector: 'zco-retention-config',
	templateUrl: './retention-config.component.html',
	styleUrl: './retention-config.component.scss',
	changeDetection: ChangeDetectionStrategy.Eager,
	imports: [
		MatCard,
		MatIcon,
		MatProgressSpinner,
		FormsModule,
		ReactiveFormsModule,
		MatFormField,
		MatLabel,
		MatInput,
		MatSuffix,
		MatHint,
		MatError,
		ObMatErrorDirective,
		MatButton,
		ObIconButtonDirective,
		ObButtonDirective,
		TranslatePipe
	]
})
export class RetentionConfigComponent implements OnInit, OnDestroy {
	form!: FormGroup;
	isLoading = false;
	isSaving = false;

	private readonly destroy$ = new Subject<void>();
	private readonly fb = inject(FormBuilder);
	private readonly retentionConfigService = inject(RetentionConfigService);
	private readonly notif = inject(ObNotificationService);

	ngOnInit(): void {
		this.form = this.fb.group({
			daysBeforeArchival: [null, [Validators.required, Validators.min(1)]],
			daysBeforeDeletion: [null, [Validators.required, Validators.min(1)]]
		});
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
