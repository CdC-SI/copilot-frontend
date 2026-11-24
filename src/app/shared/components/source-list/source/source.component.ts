import {ChangeDetectionStrategy, Component, Input, computed, inject} from '@angular/core';
import {MessageSource} from '../../../model/chat-history';
import {ObExternalLinkDirective, ObNotificationService} from '@oblique/oblique';
import {UploadService} from '../../../services/upload.service';
import {openOrDownloadBlob} from '../../../utils/file-download.utils';
import {TranslatePipe} from '@ngx-translate/core';
import {SourceViewerStore} from '../../source-viewer/source-viewer.store';

@Component({
	selector: 'zco-source',
	templateUrl: './source.component.html',
	styleUrl: './source.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [ObExternalLinkDirective, TranslatePipe]
})
export class SourceComponent {
	@Input() source: MessageSource;
	/** Sources de la réponse (ordre affiché) : navigation précédent / suivant du panneau. */
	@Input() sources: MessageSource[] = [];
	/** Réponse d'origine (`clientId`) : le panneau suit ses sources mises à jour. */
	@Input() owner?: string;
	/** Source actuellement affichée dans le panneau. */
	readonly viewerTarget = computed(() => {
		const target = this.viewer?.target();
		return target?.kind === 'source' ? target.source : undefined;
	});
	/** Panneau des sources de la page hôte (absent : téléchargement et liens directs). */
	private readonly viewer = inject(SourceViewerStore, {optional: true});
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

	/** La source s'ouvre dans le panneau (page avec panneau et source résoluble par le backend). */
	opensInViewer(source: MessageSource): boolean {
		return !!this.viewer && SourceViewerStore.canOpen(source);
	}

	isViewed(source: MessageSource): boolean {
		const viewed = this.viewerTarget();
		return !!viewed && viewed.documentId === source.documentId && viewed.citation === source.citation;
	}

	openInViewer(source: MessageSource): void {
		this.viewer?.open(source, this.sources.length ? this.sources : [source], this.owner);
	}

	label(source: MessageSource): string {
		if (this.isUrl(source)) return this.extractLabel(source.link);
		if (this.isFile(source)) return this.fileName(source.link);
		return source.title || source.link;
	}

	downloadFile(source: MessageSource): void {
		this.uploadService.downloadSourceDocument(source.link).subscribe({
			next: blob => openOrDownloadBlob(blob, this.fileName(source.link)),
			error: () => this.notifService.error('sourceList.download.error')
		});
	}
}
