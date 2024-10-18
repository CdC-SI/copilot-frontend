import {HttpClient, HttpEvent} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {ChatRequest} from '../model/rag';
import {ConfigurationService} from '../../core/app-configuration/configuration.service';
import {Observable} from 'rxjs';

@Injectable({
	providedIn: 'root'
})
export class RagService {
	constructor(
		private readonly http: HttpClient,
		private readonly config: ConfigurationService
	) {}

	process(ragRequest: ChatRequest): Observable<HttpEvent<string>> {
		const headers = {'Content-Type': 'application/json', Accept: 'text/event-stream'};
		return this.http.post(this.config.backendApi('/rag/query'), ragRequest, {headers, reportProgress: true, observe: 'events', responseType: 'text'});
	}
}
