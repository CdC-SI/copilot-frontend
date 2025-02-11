import {EventEmitter, Injectable} from '@angular/core';

@Injectable({
	providedIn: 'root'
})
export class SettingsEventService {
	settingsNeedRefresh = new EventEmitter<void>();

	emitSettingsRefresh() {
		this.settingsNeedRefresh.emit();
	}
}
