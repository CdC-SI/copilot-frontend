import {Component, Inject} from '@angular/core';
import {MAT_DIALOG_DATA, MatDialogRef} from '@angular/material/dialog';
import {LEGAL_CONFIDENTIALITY_TEXT, LEGAL_GCU_TEXT} from '../../constants/legal-texts.constants';

export interface LegalDocumentDialogData {
	selectedTab?: 'confidentiality' | 'gcu';
}

@Component({
	selector: 'zco-legal-document-dialog',
	templateUrl: './legal-document-dialog.component.html',
	styleUrl: './legal-document-dialog.component.scss'
})
export class LegalDocumentDialogComponent {
	selectedTabIndex: number = 0;
	confidentialityText = LEGAL_CONFIDENTIALITY_TEXT;
	gcuText = LEGAL_GCU_TEXT;

	constructor(
		@Inject(MAT_DIALOG_DATA) public data: LegalDocumentDialogData,
		private readonly dialogRef: MatDialogRef<LegalDocumentDialogComponent>
	) {
		if (data?.selectedTab === 'gcu') {
			this.selectedTabIndex = 1;
		}
	}

	close(): void {
		this.dialogRef.close();
	}
}
