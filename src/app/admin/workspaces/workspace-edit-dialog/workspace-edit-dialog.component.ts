import {Component, Inject, OnInit} from '@angular/core';
import {FormBuilder, FormControl, FormGroup, Validators} from '@angular/forms';
import {MAT_DIALOG_DATA, MatDialogRef} from '@angular/material/dialog';
import {MatChipInputEvent} from '@angular/material/chips';
import {COMMA, ENTER} from '@angular/cdk/keycodes';
import {CreateWorkspaceRequest, UpdateWorkspaceRequest, WorkspaceDto} from '../../../shared/model/workspace';
import {SourceService} from '../../../shared/services/source.service';
import {SourceDto} from '../../../shared/model/source';

export interface WorkspaceEditDialogData {
	workspace?: WorkspaceDto;
}

export type WorkspaceEditDialogResult = {name: string; request: CreateWorkspaceRequest | UpdateWorkspaceRequest; isEdit: boolean};

@Component({
	selector: 'zco-workspace-edit-dialog',
	templateUrl: './workspace-edit-dialog.component.html',
	styleUrl: './workspace-edit-dialog.component.scss'
})
export class WorkspaceEditDialogComponent implements OnInit {
	readonly isEdit: boolean;
	readonly separatorKeyCodes = [ENTER, COMMA];
	form: FormGroup;
	hypotheticalQuestions: string[];
	availableSources: SourceDto[] = [];

	constructor(
		private readonly fb: FormBuilder,
		private readonly sourceService: SourceService,
		private readonly ref: MatDialogRef<WorkspaceEditDialogComponent, WorkspaceEditDialogResult>,
		@Inject(MAT_DIALOG_DATA) public data: WorkspaceEditDialogData
	) {
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
