import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {ConfigurationService} from '../../core/app-configuration/configuration.service';
import {CreateWorkspaceRequest, UpdateWorkspaceRequest, WorkspaceDto} from '../model/workspace';

@Injectable({providedIn: 'root'})
export class WorkspaceService {
	private readonly WORKSPACES_URL = '/workspaces';

	constructor(
		private readonly config: ConfigurationService,
		private readonly http: HttpClient
	) {}

	/** GET /api/workspaces */
	getAll(): Observable<WorkspaceDto[]> {
		return this.http.get<WorkspaceDto[]>(this.config.backendApi(this.WORKSPACES_URL));
	}

	/** GET /api/workspaces/{name} */
	getByName(name: string): Observable<WorkspaceDto> {
		return this.http.get<WorkspaceDto>(this.config.backendApi(`${this.WORKSPACES_URL}/${encodeURIComponent(name)}`));
	}

	/** POST /api/workspaces */
	create(request: CreateWorkspaceRequest): Observable<WorkspaceDto> {
		return this.http.post<WorkspaceDto>(this.config.backendApi(this.WORKSPACES_URL), request);
	}

	/** PUT /api/workspaces/{name} */
	update(name: string, request: UpdateWorkspaceRequest): Observable<WorkspaceDto> {
		return this.http.put<WorkspaceDto>(this.config.backendApi(`${this.WORKSPACES_URL}/${encodeURIComponent(name)}`), request);
	}

	/** DELETE /api/workspaces/{name} */
	delete(name: string): Observable<void> {
		return this.http.delete<void>(this.config.backendApi(`${this.WORKSPACES_URL}/${encodeURIComponent(name)}`));
	}
}
