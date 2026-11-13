import {Injectable} from '@angular/core';
import {Observable} from 'rxjs';
import {HttpClient} from '@angular/common/http';
import {ConfigurationService} from '../../core/app-configuration/configuration.service';
import {IdentityCheckResponse, IdentityCheckStartRequest, IdentityCheckStatus} from '../model/identity-check';

@Injectable({
	providedIn: 'root'
})
export class IdentityCheckService {
	private readonly START_ID_CHECK_URL = '/identity-check/start';
	private readonly GET_ID_CHECK_STATUS_URL = '/identity-check/status';

	constructor(
		private readonly config: ConfigurationService,
		private readonly http: HttpClient
	) {}

	startIdentyCheck(data: IdentityCheckStartRequest): Observable<IdentityCheckResponse> {
		return this.http.post<IdentityCheckResponse>(this.config.backendApi(this.START_ID_CHECK_URL), data);
	}

	getIdentityCheckStatus(): Observable<IdentityCheckStatus> {
		return this.http.get<IdentityCheckStatus>(this.config.backendApi(this.GET_ID_CHECK_STATUS_URL));
	}
}
