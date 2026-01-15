import {Injectable} from '@angular/core';
import {ObNotificationService} from '@oblique/oblique';
import {UploadService} from '../../shared/services/upload.service';
import {SettingsEventService} from '../../shared/services/settings-event.service';

@Injectable({
	providedIn: 'root'
})
export class ChatFileUploadService {
	constructor(
		private readonly uploadService: UploadService,
		private readonly notif: ObNotificationService,
		private readonly settingsEventService: SettingsEventService
	) {}

	uploadDocument(conversationId?: string): void {
		const fileInput = document.createElement('input');
		fileInput.type = 'file';
		fileInput.accept = '.pdf';

		fileInput.onchange = (e: Event) => {
			const file = (e.target as HTMLInputElement).files?.[0];
			if (file) {
				this.uploadService.uploadPersonalPdf(file, conversationId).subscribe({
					next: () => {
						this.notif.success('upload.success');
						this.settingsEventService.emitSettingsRefresh();
					},
					error: err => {
						if (err.statusText === 'Unknown Error') {
							this.notif.error('upload.error');
						} else {
							this.notif.error(err.error['MESSAGE']);
						}
					}
				});
			}
		};

		fileInput.click();
	}
}
