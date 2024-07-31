import {HttpClient, HttpParams} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {Observable} from 'rxjs';
import {ConfigurationService} from '../../core/app-configuration/configuration.service';
import { IQuestion } from "../model/answer";

@Injectable({
	providedIn: 'root'
})
export class AutocompleteService {
	constructor(
		private readonly http: HttpClient,
		private readonly config: ConfigurationService
	) {}

	search(requested: string): Observable<IQuestion[]> {
		return this.http.get<IQuestion[]>(this.config.autocompleteApi('/'), {params: new HttpParams().set('question', requested)});
	}
}
