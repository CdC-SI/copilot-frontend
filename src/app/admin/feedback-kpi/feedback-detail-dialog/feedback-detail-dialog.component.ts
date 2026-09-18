import {Component, Inject} from '@angular/core';
import {MAT_DIALOG_DATA} from '@angular/material/dialog';
import {FeedbackStatus, IMessageFeedback} from '../../../shared/model/feedback';
import {FeedbackService} from '../../../shared/services/feedback.service';
import {ObNotificationService} from '@oblique/oblique';

@Component({
	selector: 'zco-feedback-detail-dialog',
	templateUrl: './feedback-detail-dialog.component.html',
	styleUrl: './feedback-detail-dialog.component.scss'
})
export class FeedbackDetailDialogComponent {
	constructor(
		@Inject(MAT_DIALOG_DATA) public data: IMessageFeedback,
		private readonly feedbackService: FeedbackService,
		private readonly notif: ObNotificationService
	) {}

	onStatusChange(status: FeedbackStatus): void {
		const previous = this.data.status;
		this.data.status = status; // optimistic update, data is the same object reference as the table row
		this.feedbackService.updateMessageFeedbackStatus(this.data.id, status).subscribe({
			next: updated => (this.data.status = updated.status),
			error: () => {
				this.data.status = previous;
				this.notif.error('admin.feedback.status.error');
			}
		});
	}
}
