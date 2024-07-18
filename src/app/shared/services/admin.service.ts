import {Injectable} from '@angular/core';
import {IFaqItem} from '../model/faq';
import {HttpClient} from '@angular/common/http';
import {ConfigurationService} from '../../core/app-configuration/configuration.service';
import {Observable} from 'rxjs';

@Injectable({
	providedIn: 'root'
})
export class AdminService {
	private llmAnswerToInsert: IFaqItem;

	constructor(
		private readonly http: HttpClient,
		private readonly config: ConfigurationService
	) {}
	setLlmAnswerToInsert(llmAnswer: IFaqItem): void {
		this.llmAnswerToInsert = llmAnswer;
	}

	getLlmAnswerToInsert(): IFaqItem {
		return this.llmAnswerToInsert;
	}
	addFaqItem(faqItem: IFaqItem): Observable<any> {
		const headers = {
			'Content-Type': 'application/json',
			Accept: 'application/json'
		};
		return this.http.put(this.config.indexingApi('/data'), faqItem, {headers});
	}
}
