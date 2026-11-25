import {MatTooltip} from '@angular/material/tooltip';
import {ChangeDetectionStrategy, Component, inject} from '@angular/core';
import {IDocument} from '../../shared/model/document';
import {ObButtonDirective, ObEUploadEventType, ObFileUploadComponent, ObIUploadEvent, ObIconButtonDirective, ObNotificationService} from '@oblique/oblique';
import {UploadService} from '../../shared/services/upload.service';
import {uploadErrorNotification} from '../../shared/utils/upload-error.utils';
import {MatButton, MatIconButton} from '@angular/material/button';
import {MatIcon} from '@angular/material/icon';
import {DecimalPipe} from '@angular/common';
import {TranslatePipe} from '@ngx-translate/core';

@Component({
	selector: 'zco-doc-upload',
	templateUrl: './doc-upload.component.html',
	styleUrl: './doc-upload.component.scss',
	changeDetection: ChangeDetectionStrategy.Eager,
	imports: [ObFileUploadComponent, MatIconButton, ObIconButtonDirective, ObButtonDirective, MatIcon, MatButton, MatTooltip, DecimalPipe, TranslatePipe]
})
export class DocUploadComponent {
	documentsToUpload: IDocument[] = [];
	private readonly uploadService = inject(UploadService);
	private readonly notifService = inject(ObNotificationService);

	uploadAdminDocument(event: ObIUploadEvent) {
		if (event.type === ObEUploadEventType.CHOSEN) {
			event.files.forEach(file => {
				if (file instanceof File) {
					this.documentsToUpload.push({file, fileName: file.name, fileSize: file.size});
				}
			});
		}
	}

	removeDocument(doc: IDocument) {
		this.documentsToUpload.splice(this.documentsToUpload.indexOf(doc), 1);
	}

	uploadDocuments() {
		this.uploadService.uploadAdminDocs(this.documentsToUpload).subscribe({
			next: () => {
				this.notifService.success('admin.document.upload.success');
				this.documentsToUpload = [];
			},
			error: err => this.notifService.error(uploadErrorNotification(err, 'admin.document.upload.error'))
		});
	}
}
