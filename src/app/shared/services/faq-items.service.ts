import {HttpClient, HttpParams} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {Observable} from 'rxjs';
import {ConfigurationService} from '../../core/app-configuration/configuration.service';
import {IQuestion} from '../model/answer';
import {IFaqItem} from '../model/faq';

@Injectable({
	providedIn: 'root'
})
export class FaqItemsService {
	constructor(
		private readonly http: HttpClient,
		private readonly config: ConfigurationService
	) {}

	search(requested: string): Observable<IQuestion[]> {
		return this.http.get<IQuestion[]>(this.config.backendApi('/faq-items'), {params: new HttpParams().set('question', requested)});
	}

	add(faqItem: IFaqItem): Observable<any> {
		const headers = {'Content-Type': 'application/json', Accept: 'application/json'};
		return this.http.put(this.config.backendApi('/faq-items'), faqItem, {headers});
	}
}
