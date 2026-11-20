import {ChangeDetectionStrategy, Component, inject} from '@angular/core';
import {FormBuilder, FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators} from '@angular/forms';
import {MAT_DIALOG_DATA, MatDialogActions, MatDialogContent, MatDialogRef, MatDialogTitle} from '@angular/material/dialog';
import {MatChipGrid, MatChipInput, MatChipInputEvent, MatChipRemove, MatChipRow} from '@angular/material/chips';
import {COMMA, ENTER} from '@angular/cdk/keycodes';
import {CreateSourceRequest, SourceDto, UpdateSourceRequest} from '../../../shared/model/source';
import {CdkScrollable} from '@angular/cdk/scrolling';
import {MatError, MatFormField, MatLabel} from '@angular/material/form-field';
import {MatInput} from '@angular/material/input';
import {ObButtonDirective, ObIconButtonDirective, ObMatErrorDirective} from '@oblique/oblique';
import {MatIcon} from '@angular/material/icon';
import {MatButton} from '@angular/material/button';
import {TranslatePipe} from '@ngx-translate/core';

export interface SourceEditDialogData {
	source?: SourceDto;
}

export type SourceEditDialogResult = {name: string; request: CreateSourceRequest | UpdateSourceRequest; isEdit: boolean};

@Component({
	selector: 'zco-source-edit-dialog',
	templateUrl: './source-edit-dialog.component.html',
	styleUrl: './source-edit-dialog.component.scss',
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
		MatError,
		ObMatErrorDirective,
		MatChipGrid,
		MatChipRow,
		MatChipRemove,
		MatIcon,
		MatChipInput,
		MatDialogActions,
		MatButton,
		ObIconButtonDirective,
		ObButtonDirective,
		TranslatePipe
	]
})
export class SourceEditDialogComponent {
	data = inject<SourceEditDialogData>(MAT_DIALOG_DATA);

	readonly isEdit: boolean;
	readonly separatorKeyCodes = [ENTER, COMMA];
	form: FormGroup;
	hypotheticalQuestions: string[];
	private readonly fb = inject(FormBuilder);
	private readonly ref = inject<MatDialogRef<SourceEditDialogComponent, SourceEditDialogResult>>(MatDialogRef);

	constructor() {
		const data = this.data;

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
