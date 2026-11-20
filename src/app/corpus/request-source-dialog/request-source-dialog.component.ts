import {ChangeDetectionStrategy, Component, inject} from '@angular/core';
import {FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators} from '@angular/forms';
import {MatDialogActions, MatDialogContent, MatDialogRef, MatDialogTitle} from '@angular/material/dialog';
import {ISourceRequest} from '../../shared/model/source-request';
import {CdkScrollable} from '@angular/cdk/scrolling';
import {MatError, MatFormField, MatHint, MatLabel} from '@angular/material/form-field';
import {MatInput} from '@angular/material/input';
import {ObButtonDirective, ObIconButtonDirective, ObMatErrorDirective} from '@oblique/oblique';
import {MatButton} from '@angular/material/button';
import {TranslatePipe} from '@ngx-translate/core';

@Component({
	selector: 'zco-request-source-dialog',
	templateUrl: './request-source-dialog.component.html',
	styleUrl: './request-source-dialog.component.scss',
	changeDetection: ChangeDetectionStrategy.Eager,
	imports: [
		MatDialogTitle,
		CdkScrollable,
		MatDialogContent,
		FormsModule,
		ReactiveFormsModule,
		MatFormField,
		MatLabel,
		MatInput,
		MatHint,
		MatError,
		ObMatErrorDirective,
		MatDialogActions,
		MatButton,
		ObIconButtonDirective,
		ObButtonDirective,
		TranslatePipe
	]
})
export class RequestSourceDialogComponent {
	form: FormGroup;
	private readonly fb = inject(FormBuilder);
	private readonly ref = inject<MatDialogRef<RequestSourceDialogComponent, ISourceRequest | null>>(MatDialogRef);

	constructor() {
		this.form = this.fb.group({
			sourceName: ['', [Validators.required, Validators.maxLength(200)]],
			description: ['', [Validators.required, Validators.maxLength(1000)]]
		});
	}

	cancel(): void {
		this.ref.close(null);
	}

	submit(): void {
		if (this.form.invalid) {
			this.form.markAllAsTouched();
			return;
		}
		this.ref.close(this.form.value as ISourceRequest);
	}
}
