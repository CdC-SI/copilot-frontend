import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {ConfigurationService} from '../../core/app-configuration/configuration.service';
import {CreateSourceRequest, SourceDto, UpdateSourceRequest} from '../model/source';

@Injectable({providedIn: 'root'})
export class SourceService {
	private readonly SOURCES_URL = '/sources';

	constructor(
		private readonly config: ConfigurationService,
		private readonly http: HttpClient
	) {}

	/** GET /api/sources */
	getAll(): Observable<SourceDto[]> {
		return this.http.get<SourceDto[]>(this.config.backendApi(this.SOURCES_URL));
	}

	/** GET /api/sources/{name} */
	getByName(name: string): Observable<SourceDto> {
		return this.http.get<SourceDto>(this.config.backendApi(`${this.SOURCES_URL}/${encodeURIComponent(name)}`));
	}

	/** POST /api/sources */
	create(request: CreateSourceRequest): Observable<SourceDto> {
		return this.http.post<SourceDto>(this.config.backendApi(this.SOURCES_URL), request);
	}

	/** PUT /api/sources/{name} */
	update(name: string, request: UpdateSourceRequest): Observable<SourceDto> {
		return this.http.put<SourceDto>(this.config.backendApi(`${this.SOURCES_URL}/${encodeURIComponent(name)}`), request);
	}

	/** DELETE /api/sources/{name} */
	delete(name: string): Observable<void> {
		return this.http.delete<void>(this.config.backendApi(`${this.SOURCES_URL}/${encodeURIComponent(name)}`));
	}
}
