import {ChangeDetectionStrategy, Component, OnInit, inject} from '@angular/core';
import {FormBuilder, FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators} from '@angular/forms';
import {MAT_DIALOG_DATA, MatDialogActions, MatDialogContent, MatDialogRef, MatDialogTitle} from '@angular/material/dialog';
import {MatChipGrid, MatChipInput, MatChipInputEvent, MatChipRemove, MatChipRow} from '@angular/material/chips';
import {COMMA, ENTER} from '@angular/cdk/keycodes';
import {CreateWorkspaceRequest, UpdateWorkspaceRequest, WorkspaceDto} from '../../../shared/model/workspace';
import {SourceService} from '../../../shared/services/source.service';
import {SourceDto} from '../../../shared/model/source';
import {CdkScrollable} from '@angular/cdk/scrolling';
import {MatError, MatFormField, MatLabel} from '@angular/material/form-field';
import {MatInput} from '@angular/material/input';
import {ObButtonDirective, ObIconButtonDirective, ObMatErrorDirective} from '@oblique/oblique';
import {MatSelect} from '@angular/material/select';
import {MatOption} from '@angular/material/core';
import {MatIcon} from '@angular/material/icon';
import {MatButton} from '@angular/material/button';
import {TranslatePipe} from '@ngx-translate/core';

export interface WorkspaceEditDialogData {
	workspace?: WorkspaceDto;
}

export type WorkspaceEditDialogResult = {name: string; request: CreateWorkspaceRequest | UpdateWorkspaceRequest; isEdit: boolean};

@Component({
	selector: 'zco-workspace-edit-dialog',
	templateUrl: './workspace-edit-dialog.component.html',
	styleUrl: './workspace-edit-dialog.component.scss',
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
		MatSelect,
		MatOption,
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
export class WorkspaceEditDialogComponent implements OnInit {
	data = inject<WorkspaceEditDialogData>(MAT_DIALOG_DATA);

	readonly isEdit: boolean;
	readonly separatorKeyCodes = [ENTER, COMMA];
	form: FormGroup;
	hypotheticalQuestions: string[];
	availableSources: SourceDto[] = [];
	private readonly fb = inject(FormBuilder);
	private readonly sourceService = inject(SourceService);
	private readonly ref = inject<MatDialogRef<WorkspaceEditDialogComponent, WorkspaceEditDialogResult>>(MatDialogRef);

	constructor() {
		const data = this.data;

		this.isEdit = !!data?.workspace;
		this.hypotheticalQuestions = [...(data?.workspace?.hypotheticalQuestions ?? [])];

		this.form = this.fb.group({
			name: new FormControl({value: data?.workspace?.name ?? '', disabled: this.isEdit}, [Validators.required, Validators.maxLength(255)]),
			description: [data?.workspace?.description ?? '', Validators.maxLength(10_000)],
			sources: [[...(data?.workspace?.sources ?? [])]]
		});
	}

	ngOnInit(): void {
		this.sourceService.getAll().subscribe({
			next: sources => (this.availableSources = sources),
			error: () => (this.availableSources = [])
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
		const request: CreateWorkspaceRequest | UpdateWorkspaceRequest = this.isEdit
			? {description: v.description, hypotheticalQuestions: this.hypotheticalQuestions, sources: v.sources}
			: {name: v.name, description: v.description, hypotheticalQuestions: this.hypotheticalQuestions, sources: v.sources};
		this.ref.close({name: v.name, request, isEdit: this.isEdit});
	}
}
