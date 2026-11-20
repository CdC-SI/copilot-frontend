import {Injectable, inject} from '@angular/core';
import {ConfigurationService} from '../../core/app-configuration/configuration.service';
import {HttpClient} from '@angular/common/http';
import {SettingsType} from '../model/settings';

@Injectable({
	providedIn: 'root'
})
export class SettingsService {
	private readonly config = inject(ConfigurationService);
	private readonly http = inject(HttpClient);

	public getSettings(type: SettingsType) {
		return this.http.get<string[]>(this.config.backendApi(`/settings?type=${type}`));
	}

	public getFilteredTags(sources: string) {
		return this.http.get<string[]>(this.config.backendApi(`/settings/tags?sources=${sources}`));
	}
}
