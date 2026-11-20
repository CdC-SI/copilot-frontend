import {ChangeDetectionStrategy, Component, inject} from '@angular/core';
import {MAT_DIALOG_DATA, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogTitle} from '@angular/material/dialog';
import {FeedbackStatus, IDocumentFeedbackDetail, ISourceFeedback} from '../../../shared/model/feedback';
import {UploadService} from '../../../shared/services/upload.service';
import {ObButtonDirective, ObExternalLinkDirective, ObIconButtonDirective, ObNotificationService} from '@oblique/oblique';
import {FeedbackService} from '../../../shared/services/feedback.service';
import {openOrDownloadBlob} from '../../../shared/utils/file-download.utils';
import {CdkScrollable} from '@angular/cdk/scrolling';
import {MatButton} from '@angular/material/button';
import {MatIcon} from '@angular/material/icon';
import {MatAccordion, MatExpansionPanel, MatExpansionPanelDescription, MatExpansionPanelHeader, MatExpansionPanelTitle} from '@angular/material/expansion';
import {FeedbackStatusSelectComponent} from '../feedback-status-select/feedback-status-select.component';
import {MarkdownComponent} from 'ngx-markdown';
import {DatePipe} from '@angular/common';
import {TranslatePipe} from '@ngx-translate/core';

@Component({
	selector: 'zco-document-feedback-detail-dialog',
	templateUrl: './document-feedback-detail-dialog.component.html',
	styleUrl: './document-feedback-detail-dialog.component.scss',
	changeDetection: ChangeDetectionStrategy.Eager,
	imports: [
		MatDialogTitle,
		CdkScrollable,
		MatDialogContent,
		ObExternalLinkDirective,
		MatButton,
		ObIconButtonDirective,
		ObButtonDirective,
		MatIcon,
		MatAccordion,
		MatExpansionPanel,
		MatExpansionPanelHeader,
		MatExpansionPanelTitle,
		MatExpansionPanelDescription,
		FeedbackStatusSelectComponent,
		MarkdownComponent,
		MatDialogActions,
		MatDialogClose,
		DatePipe,
		TranslatePipe
	]
})
export class DocumentFeedbackDetailDialogComponent {
	data = inject<IDocumentFeedbackDetail>(MAT_DIALOG_DATA);
	private readonly uploadService = inject(UploadService);
	private readonly notifService = inject(ObNotificationService);
	private readonly feedbackService = inject(FeedbackService);

	downloadFile() {
		this.uploadService.downloadSourceDocument(this.data.documentTitle).subscribe({
			next: blob => openOrDownloadBlob(blob, this.data.documentTitle),
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
