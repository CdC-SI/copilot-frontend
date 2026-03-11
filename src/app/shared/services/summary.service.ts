import {Injectable} from '@angular/core';
import {Observable} from 'rxjs';
import {HttpClient} from '@angular/common/http';
import {ConfigurationService} from '../../core/app-configuration/configuration.service';
import {SummaryDetailResponse, SummaryTaskCreatedResponse, SummaryTaskResponse} from '../model/summary';

@Injectable({
	providedIn: 'root'
})
export class SummaryService {
	private readonly SUMMARIES_URL = '/summaries';

	constructor(
		private readonly config: ConfigurationService,
		private readonly http: HttpClient
	) {}

	createSummary(navs: string): Observable<SummaryTaskCreatedResponse> {
		return this.http.post<SummaryTaskCreatedResponse>(this.config.backendApi(`${this.SUMMARIES_URL}/${navs}`), {});
	}

	getAllTasks(): Observable<SummaryTaskResponse[]> {
		return this.http.get<SummaryTaskResponse[]>(this.config.backendApi(this.SUMMARIES_URL));
	}

	getSummaryDetail(id: number): Observable<SummaryDetailResponse> {
		return this.http.get<SummaryDetailResponse>(this.config.backendApi(`${this.SUMMARIES_URL}/${id}`));
	}

	retrySummary(id: number): Observable<SummaryTaskResponse> {
		return this.http.put<SummaryTaskResponse>(this.config.backendApi(`${this.SUMMARIES_URL}/${id}`), {});
	}

	openReferences(id: number): Observable<{message: string; taskId: number; referencesCount: number}> {
		return this.http.post<{message: string; taskId: number; referencesCount: number}>(
			this.config.backendApi(`${this.SUMMARIES_URL}/${id}/open-references`),
			{}
		);
	}
}
