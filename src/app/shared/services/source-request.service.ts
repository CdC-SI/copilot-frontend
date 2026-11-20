import {Injectable, inject} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {ConfigurationService} from '../../core/app-configuration/configuration.service';
import {ISourceRequest} from '../model/source-request';

@Injectable({
	providedIn: 'root'
})
export class SourceRequestService {
	private readonly config = inject(ConfigurationService);
	private readonly http = inject(HttpClient);

	private readonly SOURCE_REQUESTS_URL = '/source-requests';

	getMyRequests(): Observable<ISourceRequest[]> {
		return this.http.get<ISourceRequest[]>(this.config.backendApi(`${this.SOURCE_REQUESTS_URL}/my`));
	}

	createRequest(request: ISourceRequest): Observable<ISourceRequest> {
		return this.http.post<ISourceRequest>(this.config.backendApi(this.SOURCE_REQUESTS_URL), request);
	}

	updateRequest(id: number, request: Partial<ISourceRequest>): Observable<ISourceRequest> {
		return this.http.put<ISourceRequest>(this.config.backendApi(`${this.SOURCE_REQUESTS_URL}/${id}`), request);
	}

	deleteRequest(id: number): Observable<void> {
		return this.http.delete<void>(this.config.backendApi(`${this.SOURCE_REQUESTS_URL}/${id}`));
	}
}
