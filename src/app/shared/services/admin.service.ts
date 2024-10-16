import {Injectable} from '@angular/core';
import {IFaqItem} from '../model/faq';
import {HttpClient} from '@angular/common/http';
import {ConfigurationService} from '../../core/app-configuration/configuration.service';
import {Observable} from 'rxjs';

@Injectable({
	providedIn: 'root'
})
export class AdminService {
	constructor(
		private readonly http: HttpClient,
		private readonly config: ConfigurationService
	) {}

	addFaqItem(faqItem: IFaqItem): Observable<any> {
		const headers = {'Content-Type': 'application/json', Accept: 'application/json'};
		return this.http.put(this.config.indexingApi('/data'), faqItem, {headers});
	}
}
