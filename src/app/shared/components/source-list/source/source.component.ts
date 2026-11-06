import {Component, Input} from '@angular/core';
import {MessageSource} from '../../../model/chat-history';
import {ObNotificationService} from '@oblique/oblique';
import {UploadService} from '../../../services/upload.service';
import {openOrDownloadBlob} from '../../../utils/file-download.utils';

@Component({
	selector: 'zco-source',
	templateUrl: './source.component.html',
	styleUrl: './source.component.scss'
})
export class SourceComponent {
	@Input() source: MessageSource;

	constructor(
		private readonly notifService: ObNotificationService,
		private readonly uploadService: UploadService
	) {}

	isFile(s: MessageSource): boolean {
		return s.type === 'FILE';
	}

	isUrl(s: MessageSource): boolean {
		return s.type === 'URL';
	}

	extractLabel(link: string): string {
		try {
			const {hostname, pathname} = new URL(link);
			return hostname.replace(/^www\./, '') + pathname;
		} catch (_) {
			return link;
		}
	}

	fileName(path: string): string {
		return path.split('/').pop() ?? path;
	}

	downloadFile(source: MessageSource): void {
		this.uploadService.downloadSourceDocument(source.link).subscribe({
			next: blob => openOrDownloadBlob(blob, this.fileName(source.link)),
			error: () => this.notifService.error('sourceList.download.error')
		});
	}
}
