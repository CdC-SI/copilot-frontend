import {Component} from '@angular/core';
import {FormBuilder, FormGroup, Validators} from '@angular/forms';
import {MatDialogRef} from '@angular/material/dialog';
import {ISourceRequest} from '../../shared/model/source-request';

@Component({
	selector: 'zco-request-source-dialog',
	templateUrl: './request-source-dialog.component.html',
	styleUrl: './request-source-dialog.component.scss'
})
export class RequestSourceDialogComponent {
	form: FormGroup;

	constructor(
		private readonly fb: FormBuilder,
		private readonly ref: MatDialogRef<RequestSourceDialogComponent, ISourceRequest | null>
	) {
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
