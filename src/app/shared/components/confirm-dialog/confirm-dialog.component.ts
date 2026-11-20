import {ChangeDetectionStrategy, Component, inject} from '@angular/core';
import {MAT_DIALOG_DATA, MatDialogActions, MatDialogContent, MatDialogRef, MatDialogTitle} from '@angular/material/dialog';
import {ObAlertComponent, ObButtonDirective, ObIAlertType, ObIconButtonDirective} from '@oblique/oblique';
import {CdkScrollable} from '@angular/cdk/scrolling';
import {MatButton} from '@angular/material/button';
import {MatIcon} from '@angular/material/icon';
import {TranslatePipe} from '@ngx-translate/core';

@Component({
	selector: 'confirm-dialog',
	templateUrl: './confirm-dialog.component.html',
	styleUrls: ['./confirm-dialog.component.scss'],
	changeDetection: ChangeDetectionStrategy.Eager,
	imports: [
		MatDialogTitle,
		CdkScrollable,
		MatDialogContent,
		ObAlertComponent,
		MatDialogActions,
		MatButton,
		ObIconButtonDirective,
		ObButtonDirective,
		MatIcon,
		TranslatePipe
	]
})
export class ConfirmDialogComponent {
	data = inject<{
		title: string;
		content: string;
		type?: ObIAlertType;
	}>(MAT_DIALOG_DATA);
	dialogRef = inject<MatDialogRef<ConfirmDialogComponent>>(MatDialogRef);

	type: ObIAlertType = 'info';
	constructor() {
		const data = this.data;

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
