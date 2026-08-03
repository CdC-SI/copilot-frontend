import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {ConfigurationService} from '../../core/app-configuration/configuration.service';
import {DocumentRetentionConfig} from '../model/document-retention-config';

@Injectable({providedIn: 'root'})
export class RetentionConfigService {
	constructor(
		private readonly config: ConfigurationService,
		private readonly http: HttpClient
	) {}

	get(): Observable<DocumentRetentionConfig> {
		return this.http.get<DocumentRetentionConfig>(this.config.backendApi('/documents/retention-config'));
	}

	update(config: DocumentRetentionConfig): Observable<DocumentRetentionConfig> {
		return this.http.put<DocumentRetentionConfig>(this.config.backendApi('/documents/retention-config'), config);
	}
}
