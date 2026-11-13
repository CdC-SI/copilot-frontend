import {Injectable} from '@angular/core';
import {Observable} from 'rxjs';
import {HttpClient} from '@angular/common/http';
import {ConfigurationService} from '../../core/app-configuration/configuration.service';
import {StructuredFields, SumexInvoice, ZasDocumentType} from '../model/vision';

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

	ocrFile(file: File, fields: string): Observable<StructuredFields> {
		const formData: FormData = new FormData();
		formData.append('file', file, file.name);
		formData.append('fields', fields);
		return this.http.post<StructuredFields>(this.config.backendApi(this.OCR_URL), formData);
	}

	classifyFile(file: File): Observable<ZasDocumentType> {
		const formData: FormData = new FormData();
		formData.append('file', file, file.name);
		return this.http.post<ZasDocumentType>(this.config.backendApi(this.CLASSIFY_URL), formData);
	}

	translateFile(file: File, language: string): Observable<{translatedText: string; detectedLanguage?: string}[]> {
		const formData: FormData = new FormData();
		formData.append('file', file, file.name);
		formData.append('language', language);
		return this.http.post<{translatedText: string}[]>(this.config.backendApi(this.TRANSLATE_URL), formData);
	}

	sumex(file: File): Observable<SumexInvoice> {
		const formData: FormData = new FormData();
		formData.append('file', file, file.name);
		return this.http.post<SumexInvoice>(this.config.backendApi('/visualize/sumex'), formData);
	}

	submitInvoice(invoice: SumexInvoice) {
		return this.http.post(this.config.backendApi('/sumex-invoices/convert'), invoice, {observe: 'response', responseType: 'blob'});
	}
}
