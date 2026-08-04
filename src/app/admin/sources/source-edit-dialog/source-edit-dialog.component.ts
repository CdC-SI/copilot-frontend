import {Component, Inject} from '@angular/core';
import {FormBuilder, FormControl, FormGroup, Validators} from '@angular/forms';
import {MAT_DIALOG_DATA, MatDialogRef} from '@angular/material/dialog';
import {MatChipInputEvent} from '@angular/material/chips';
import {COMMA, ENTER} from '@angular/cdk/keycodes';
import {CreateSourceRequest, SourceDto, UpdateSourceRequest} from '../../../shared/model/source';

export interface SourceEditDialogData {
	source?: SourceDto;
}

export type SourceEditDialogResult = {name: string; request: CreateSourceRequest | UpdateSourceRequest; isEdit: boolean};

@Component({
	selector: 'zco-source-edit-dialog',
	templateUrl: './source-edit-dialog.component.html',
	styleUrl: './source-edit-dialog.component.scss'
})
export class SourceEditDialogComponent {
	readonly isEdit: boolean;
	readonly separatorKeyCodes = [ENTER, COMMA];
	form: FormGroup;
	hypotheticalQuestions: string[];

	constructor(
		private readonly fb: FormBuilder,
		private readonly ref: MatDialogRef<SourceEditDialogComponent, SourceEditDialogResult>,
		@Inject(MAT_DIALOG_DATA) public data: SourceEditDialogData
	) {
		this.isEdit = !!data?.source;
		this.hypotheticalQuestions = [...(data?.source?.hypotheticalQuestions ?? [])];

		this.form = this.fb.group({
			name: new FormControl({value: data?.source?.name ?? '', disabled: this.isEdit}, [Validators.required, Validators.maxLength(255)]),
			description: [data?.source?.description ?? '', Validators.maxLength(10_000)]
		});
	}

	addQuestion(event: MatChipInputEvent): void {
		const value = (event.value || '').trim();
		if (value) {
			this.hypotheticalQuestions.push(value);
		}
		event.chipInput?.clear();
	}

	removeQuestion(question: string): void {
		this.hypotheticalQuestions = this.hypotheticalQuestions.filter(q => q !== question);
	}

	cancel(): void {
		this.ref.close();
	}

	submit(): void {
		if (this.form.invalid) return;
		const v = this.form.getRawValue();
		const request: CreateSourceRequest | UpdateSourceRequest = this.isEdit
			? {description: v.description, hypotheticalQuestions: this.hypotheticalQuestions}
			: {name: v.name, description: v.description, hypotheticalQuestions: this.hypotheticalQuestions};
		this.ref.close({name: v.name, request, isEdit: this.isEdit});
	}
}
