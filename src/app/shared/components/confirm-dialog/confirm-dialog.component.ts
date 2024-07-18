import {Component, Inject} from '@angular/core';
import {MAT_DIALOG_DATA, MatDialogRef} from '@angular/material/dialog';
import {ObIAlertType} from '@oblique/oblique';

@Component({
	selector: 'confirm-dialog',
	templateUrl: './confirm-dialog.component.html',
	styleUrls: ['./confirm-dialog.component.scss']
})
export class ConfirmDialogComponent {
	type: ObIAlertType = 'info';
	constructor(
		@Inject(MAT_DIALOG_DATA) public data: {title: string; content: string; type?: ObIAlertType},
		public dialogRef: MatDialogRef<ConfirmDialogComponent>
	) {
		if (data.type) {
			this.type = data.type;
		}
	}

	onReturnClick(): void {
		this.dialogRef.close(false);
	}

	onConfirmClick(): void {
		this.dialogRef.close(true);
	}
}
