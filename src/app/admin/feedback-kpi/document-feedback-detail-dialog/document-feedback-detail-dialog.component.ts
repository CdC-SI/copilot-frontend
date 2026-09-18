import {Component, Inject} from '@angular/core';
import {MAT_DIALOG_DATA} from '@angular/material/dialog';
import {FeedbackStatus, IDocumentFeedbackDetail, ISourceFeedback} from '../../../shared/model/feedback';
import {UploadService} from '../../../shared/services/upload.service';
import {ObNotificationService} from '@oblique/oblique';
import {FeedbackService} from '../../../shared/services/feedback.service';

@Component({
	selector: 'zco-document-feedback-detail-dialog',
	templateUrl: './document-feedback-detail-dialog.component.html',
	styleUrl: './document-feedback-detail-dialog.component.scss'
})
export class DocumentFeedbackDetailDialogComponent {
	constructor(
		@Inject(MAT_DIALOG_DATA) public data: IDocumentFeedbackDetail,
		private readonly uploadService: UploadService,
		private readonly notifService: ObNotificationService,
		private readonly feedbackService: FeedbackService
	) {}

	downloadFile() {
		this.uploadService.downloadSourceDocument(this.data.documentTitle).subscribe({
			next: blob => {
				const pdfBlob = new Blob([blob], {type: 'application/pdf'});
				const url = window.URL.createObjectURL(pdfBlob);
				window.open(url, '_blank');
			},
			error: () => this.notifService.error('Erreur lors du téléchargement du fichier')
		});
	}

	onStatusChange(item: ISourceFeedback, status: FeedbackStatus): void {
		const previous = item.status;
		item.status = status; // optimistic update, item is the same object reference as in the parent tables
		this.feedbackService.updateSourceFeedbackStatus(item.id, status).subscribe({
			next: updated => (item.status = updated.status),
			error: () => {
				item.status = previous;
				this.notifService.error('admin.feedback.status.error');
			}
		});
	}
}
