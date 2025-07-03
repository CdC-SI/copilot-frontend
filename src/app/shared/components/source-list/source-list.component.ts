import {Component, Input} from '@angular/core';
import {MessageSource} from '../../model/chat-history';
import {UploadService} from '../../services/upload.service';
import {ObNotificationService} from '@oblique/oblique';

@Component({
	selector: 'zco-source-list',
	templateUrl: './source-list.component.html',
	styleUrl: './source-list.component.scss'
})
export class SourceListComponent {
	@Input() sources: MessageSource[] = [];

	constructor(
		private readonly uploadService: UploadService,
		private readonly notifService: ObNotificationService
	) {}

	/** Convenience helpers */
	isUrl(s: MessageSource): boolean {
		return s.type === 'URL';
	}
	isFile(s: MessageSource): boolean {
		return s.type === 'FILE';
	}

	/** Returns a short, readable label for the link (domain + path or just file name) */
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

	/**
	 * Trigger a file download. Implement this according to your environment.
	 */
	downloadFile(source: MessageSource): void {
		this.uploadService.downloadSourceDocument(source.link).subscribe({
			next: blob => {
				const pdfBlob = new Blob([blob], {type: 'application/pdf'});
				const url = window.URL.createObjectURL(pdfBlob);
				window.open(url, '_blank');
			},
			error: () => {
				this.notifService.error('Erreur lors du téléchargement du fichier');
			}
		});
	}
}
