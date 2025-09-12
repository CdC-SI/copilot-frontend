import {Injectable} from '@angular/core';
import {Observable} from 'rxjs';
import {HttpClient} from '@angular/common/http';
import {ConfigurationService} from '../../core/app-configuration/configuration.service';

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

	startIdentyCheck(): Observable<any> {
		return this.http.post<any>(this.config.backendApi(this.START_ID_CHECK_URL), {});
	}

	getIdentityCheckStatus(): Observable<any> {
		return this.http.get<any>(this.config.backendApi(this.GET_ID_CHECK_STATUS_URL));
	}
}
