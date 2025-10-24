import {Component, Inject} from '@angular/core';
import {MAT_DIALOG_DATA} from '@angular/material/dialog';
import {IMessageFeedback} from '../../../shared/model/feedback';

@Component({
	selector: 'zco-feedback-detail-dialog',
	templateUrl: './feedback-detail-dialog.component.html',
	styleUrl: './feedback-detail-dialog.component.scss'
})
export class FeedbackDetailDialogComponent {
	constructor(@Inject(MAT_DIALOG_DATA) public data: IMessageFeedback) {}
}
