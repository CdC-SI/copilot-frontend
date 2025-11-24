import {Injectable} from '@angular/core';
import {Observable} from 'rxjs';
import {HttpClient} from '@angular/common/http';
import {ConfigurationService} from '../../core/app-configuration/configuration.service';

@Injectable({
	providedIn: 'root'
})
export class VisionService {
	private readonly OCR_URL = '/visualize/structure';
	private readonly CLASSIFY_URL = '/visualize/classify';
	private readonly TRANSLATE_URL = '/visualize/translate';

	constructor(
		private readonly config: ConfigurationService,
		private readonly http: HttpClient
	) {}

	ocrFile(file: File, fields: string): Observable<any> {
		const formData: FormData = new FormData();
		formData.append('file', file, file.name);
		formData.append('fields', fields);
		return this.http.post<any>(this.config.backendApi(this.OCR_URL), formData);
	}

	classifyFile(file: File): Observable<any> {
		const formData: FormData = new FormData();
		formData.append('file', file, file.name);
		return this.http.post<any>(this.config.backendApi(this.CLASSIFY_URL), formData);
	}

	translateFile(file: File, language: string): Observable<any> {
		const formData: FormData = new FormData();
		formData.append('file', file, file.name);
		formData.append('language', language);
		return this.http.post<any>(this.config.backendApi(this.TRANSLATE_URL), formData);
	}

	sumex(file: File): Observable<any> {
		const formData: FormData = new FormData();
		formData.append('file', file, file.name);
		return this.http.post<any>(this.config.backendApi('/visualize/sumex'), formData);
	}

	submitInvoice(invoice: any): Observable<any> {
		//TODO
		return new Observable<any>();
	}
}
