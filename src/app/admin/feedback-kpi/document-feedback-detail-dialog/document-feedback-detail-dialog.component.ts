import {Component, Inject} from '@angular/core';
import {MAT_DIALOG_DATA} from '@angular/material/dialog';
import {IDocumentFeedbackDetail} from '../../../shared/model/feedback';
import {UploadService} from '../../../shared/services/upload.service';
import {ObNotificationService} from '@oblique/oblique';

@Component({
	selector: 'zco-document-feedback-detail-dialog',
	templateUrl: './document-feedback-detail-dialog.component.html',
	styleUrl: './document-feedback-detail-dialog.component.scss'
})
export class DocumentFeedbackDetailDialogComponent {
	constructor(
		@Inject(MAT_DIALOG_DATA) public data: IDocumentFeedbackDetail,
		private readonly uploadService: UploadService,
		private readonly notifService: ObNotificationService
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
}
