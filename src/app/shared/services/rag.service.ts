import {HttpClient} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {RagRequest} from '../model/rag';

@Injectable({
	providedIn: 'root'
})
export class RagService {
	constructor(private readonly http: HttpClient) {}

	process(ragRequest: RagRequest) {
		const headers = {
			'Content-Type': 'application/json',
			Accept: 'text/event-stream'
		};
		return this.http.post(this.config.ragApi('/rag/process'), ragRequest, {headers, reportProgress: true, observe: 'events', responseType: 'text'});
	}
}
