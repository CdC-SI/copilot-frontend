import {Injectable} from '@angular/core';
import {ConfigurationService} from '../../core/app-configuration/configuration.service';
import {HttpClient} from '@angular/common/http';
import {TranslateService} from '@ngx-translate/core';
import {IDocument} from '../model/document';

@Injectable({
	providedIn: 'root'
})
export class UploadService {
	constructor(
		private readonly config: ConfigurationService,
		private readonly http: HttpClient,
		private readonly translateService: TranslateService
	) {}

	uploadPersonalPdf(file: File, conversationId?: string) {
		const formData = new FormData();
		formData.append('multipartFile', file, file.name);
		formData.append('embed', 'true');
		formData.append('lang', this.translateService.currentLang);
		if (conversationId) {
			formData.append('conversationId', conversationId);
		}

		return this.http.post<void>(this.config.backendApi('/documents/upload'), formData);
	}

	uploadAdminDocs(documents: IDocument[]) {
		const formData = new FormData();
		documents.forEach(doc => {
			formData.append('documents', doc.file, doc.fileName);
		});

		return this.http.post<void>(this.config.backendApi('/documents/upload-admin'), formData);
	}

	downloadSourceDocument(filename: string) {
		const url = this.config.backendApi('/documents');
		return this.http.get(url, {params: {filename}, responseType: 'blob'});
	}
}
