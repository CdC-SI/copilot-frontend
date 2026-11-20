import {ChangeDetectionStrategy, Component, inject} from '@angular/core';
import {MAT_DIALOG_DATA, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogTitle} from '@angular/material/dialog';
import {FeedbackStatus, IMessageFeedback} from '../../../shared/model/feedback';
import {FeedbackService} from '../../../shared/services/feedback.service';
import {ObButtonDirective, ObIconButtonDirective, ObNotificationService} from '@oblique/oblique';
import {CdkScrollable} from '@angular/cdk/scrolling';
import {FeedbackStatusSelectComponent} from '../feedback-status-select/feedback-status-select.component';
import {MarkdownComponent} from 'ngx-markdown';
import {SourceComponent} from '../../../shared/components/source-list/source/source.component';
import {MatButton} from '@angular/material/button';
import {DatePipe} from '@angular/common';
import {TranslatePipe} from '@ngx-translate/core';

@Component({
	selector: 'zco-feedback-detail-dialog',
	templateUrl: './feedback-detail-dialog.component.html',
	styleUrl: './feedback-detail-dialog.component.scss',
	changeDetection: ChangeDetectionStrategy.Eager,
	imports: [
		MatDialogTitle,
		CdkScrollable,
		MatDialogContent,
		FeedbackStatusSelectComponent,
		MarkdownComponent,
		SourceComponent,
		MatDialogActions,
		MatButton,
		MatDialogClose,
		ObIconButtonDirective,
		ObButtonDirective,
		DatePipe,
		TranslatePipe
	]
})
export class FeedbackDetailDialogComponent {
	data = inject<IMessageFeedback>(MAT_DIALOG_DATA);
	private readonly feedbackService = inject(FeedbackService);
	private readonly notif = inject(ObNotificationService);

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
