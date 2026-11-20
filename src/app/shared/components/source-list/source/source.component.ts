import {ChangeDetectionStrategy, Component, Input, inject} from '@angular/core';
import {MessageSource} from '../../../model/chat-history';
import {ObExternalLinkDirective, ObNotificationService} from '@oblique/oblique';
import {UploadService} from '../../../services/upload.service';
import {openOrDownloadBlob} from '../../../utils/file-download.utils';
import {TranslatePipe} from '@ngx-translate/core';

@Component({
	selector: 'zco-source',
	templateUrl: './source.component.html',
	styleUrl: './source.component.scss',
	changeDetection: ChangeDetectionStrategy.Eager,
	imports: [ObExternalLinkDirective, TranslatePipe]
})
export class SourceComponent {
	@Input() source: MessageSource;
	private readonly notifService = inject(ObNotificationService);
	private readonly uploadService = inject(UploadService);

	isFile(s: MessageSource): boolean {
		return s.type === 'FILE';
	}

	isUrl(s: MessageSource): boolean {
		return s.type === 'URL';
	}

	isBusinessProcess(s: MessageSource): boolean {
		return s.type === 'BUSINESS_PROCESS';
	}

	extractLabel(link: string): string {
		try {
			const {hostname, pathname} = new URL(link);
			return hostname.replace(/^www\./, '') + pathname;
		} catch {
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
