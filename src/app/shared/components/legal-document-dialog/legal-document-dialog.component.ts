import {ChangeDetectionStrategy, Component, inject} from '@angular/core';
import {MAT_DIALOG_DATA, MatDialogActions, MatDialogContent, MatDialogRef, MatDialogTitle} from '@angular/material/dialog';
import {LEGAL_CONFIDENTIALITY_TEXT, LEGAL_GCU_TEXT} from '../../constants/legal-texts.constants';
import {CdkScrollable} from '@angular/cdk/scrolling';
import {MatTab, MatTabGroup} from '@angular/material/tabs';
import {MatButton} from '@angular/material/button';
import {ObButtonDirective, ObIconButtonDirective} from '@oblique/oblique';
import {TranslatePipe} from '@ngx-translate/core';

export interface LegalDocumentDialogData {
	selectedTab?: 'confidentiality' | 'gcu';
}

@Component({
	selector: 'zco-legal-document-dialog',
	templateUrl: './legal-document-dialog.component.html',
	styleUrl: './legal-document-dialog.component.scss',
	changeDetection: ChangeDetectionStrategy.Eager,
	imports: [
		MatDialogTitle,
		CdkScrollable,
		MatDialogContent,
		MatTabGroup,
		MatTab,
		MatDialogActions,
		MatButton,
		ObIconButtonDirective,
		ObButtonDirective,
		TranslatePipe
	]
})
export class LegalDocumentDialogComponent {
	data = inject<LegalDocumentDialogData>(MAT_DIALOG_DATA);

	selectedTabIndex: number = 0;
	confidentialityText = LEGAL_CONFIDENTIALITY_TEXT;
	gcuText = LEGAL_GCU_TEXT;
	private readonly dialogRef = inject<MatDialogRef<LegalDocumentDialogComponent>>(MatDialogRef);

	constructor() {
		const data = this.data;

		if (data?.selectedTab === 'gcu') {
			this.selectedTabIndex = 1;
		}
	}

	close(): void {
		this.dialogRef.close();
	}
}
