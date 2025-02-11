import { Injectable, EventEmitter } from '@angular/core';

@Injectable({
    providedIn: 'root'
})
export class SettingsEventService {
    settingsNeedRefresh = new EventEmitter<void>();

    emitSettingsRefresh() {
        this.settingsNeedRefresh.emit();
    }
}
