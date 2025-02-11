import {Injectable} from '@angular/core';
import {ConfigurationService} from '../../core/app-configuration/configuration.service';
import {HttpClient} from '@angular/common/http';
import {TranslateService} from '@ngx-translate/core';

@Injectable({
	providedIn: 'root'
})
export class UploadService {
	constructor(
		private readonly config: ConfigurationService,
		private readonly http: HttpClient,
		private readonly translateService: TranslateService
	) {}

	uploadPdf(file: File) {
		const formData = new FormData();
		formData.append('multipartFile', file, file.name);
		formData.append('embed', 'true');
		formData.append('lang', this.translateService.currentLang);

		return this.http.post<void>(this.config.backendApi('/documents/upload'), formData);
	}
}
