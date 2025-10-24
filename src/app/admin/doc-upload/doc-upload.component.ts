import {Component} from '@angular/core';
import {IDocument} from '../../shared/model/document';
import {ObEUploadEventType, ObIUploadEvent, ObNotificationService} from '@oblique/oblique';
import {UploadService} from '../../shared/services/upload.service';

@Component({
	selector: 'zco-doc-upload',
	templateUrl: './doc-upload.component.html',
	styleUrl: './doc-upload.component.scss'
})
export class DocUploadComponent {
	documentsToUpload: IDocument[] = [];

	constructor(
		private readonly uploadService: UploadService,
		private readonly notifService: ObNotificationService
	) {}

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
			error: () => this.notifService.error('admin.document.upload.error')
		});
	}
}
