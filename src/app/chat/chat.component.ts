import {ChangeDetectionStrategy, Component, HostListener, TemplateRef, ViewChild, computed, effect, inject, signal, untracked} from '@angular/core';
import {MatDialog, MatDialogContent, MatDialogTitle} from '@angular/material/dialog';
import {MatIcon} from '@angular/material/icon';
import {CdkScrollable} from '@angular/cdk/scrolling';
import {TranslatePipe} from '@ngx-translate/core';
import {ObColumnLayoutComponent} from '@oblique/oblique';
import {AlertBannerComponent} from '../shared/components/alert-banner/alert-banner.component';
import {UserAuthDialogService} from './services';
import {ChatStore} from './chat.store';
import {ChatConversationsStore} from './chat-conversations.store';
import {ChatGenerationStore} from './chat-generation.store';
import {ChatAttachmentsStore} from './chat-attachments.store';
import {ChatSidebarComponent} from './chat-sidebar/chat-sidebar.component';
import {ChatTimelineComponent} from './chat-timeline/chat-timeline.component';
import {ChatComposerComponent} from './chat-composer/chat-composer.component';
import {SourceViewerStore} from '../shared/components/source-viewer/source-viewer.store';
import {SourceViewerPanelComponent} from '../shared/components/source-viewer/source-viewer-panel.component';

/**
 * Page de chat : mise en page (fil et panneau des sources), dépôt/collage de pièces jointes, raccourci Échap et
 * dialogues d'inscription.
 */
@Component({
	selector: 'zco-chat',
	templateUrl: './chat.component.html',
	styleUrls: ['./chat.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	providers: [ChatStore, ChatConversationsStore, ChatGenerationStore, ChatAttachmentsStore, SourceViewerStore],
	imports: [
		AlertBannerComponent,
		ObColumnLayoutComponent,
		ChatSidebarComponent,
		ChatTimelineComponent,
		ChatComposerComponent,
		SourceViewerPanelComponent,
		MatIcon,
		MatDialogTitle,
		CdkScrollable,
		MatDialogContent,
		TranslatePipe
	]
})
export class ChatComponent {
	readonly isDragOver = signal(false);

	@ViewChild('userNotRegisteredTriesToChatDialog') userNotRegisteredDialog: TemplateRef<any>;
	@ViewChild('userPendingTriesToChatDialog') userPendingTriesToChatDialog: TemplateRef<any>;
	@ViewChild('johnDoeInfoDialog') johnDoeDialog: TemplateRef<any>;

	protected readonly store = inject(ChatStore);
	protected readonly viewer = inject(SourceViewerStore);
	private readonly authDialogService = inject(UserAuthDialogService);
	private readonly dialog = inject(MatDialog);
	private readonly conversationId = computed(() => this.store.currentConversation()?.conversationId ?? null);

	constructor() {
		// Les sources affichées appartiennent à la conversation : le panneau se ferme quand on en change.
		effect(() => {
			this.conversationId();
			untracked(() => this.viewer.close());
		});
	}

	/**
	 * Échap (sauf si une boîte de dialogue est ouverte) ferme d'abord le panneau des sources, sinon arrête la
	 * génération en cours.
	 */
	@HostListener('document:keydown.escape')
	onEscape(): void {
		if (this.dialog.openDialogs.length > 0) return;
		if (this.viewer.isOpen()) {
			this.viewer.close();
		} else if (this.store.isGenerating() && !this.store.isStopping()) {
			this.store.stopGeneration();
		}
	}

	onPaste(event: ClipboardEvent): void {
		const files = Array.from(event.clipboardData?.files ?? []);
		if (files.length > 0) {
			event.preventDefault();
			this.store.addAttachments(files);
		}
	}

	onDragOver(event: DragEvent): void {
		event.preventDefault();
		this.isDragOver.set(true);
	}

	onDragLeave(event: DragEvent): void {
		event.preventDefault();
		this.isDragOver.set(false);
	}

	onDrop(event: DragEvent): void {
		event.preventDefault();
		this.isDragOver.set(false);
		const files = Array.from(event.dataTransfer?.files ?? []);
		if (files.length > 0) {
			this.store.addAttachments(files);
		}
	}

	private showDialog() {
		this.authDialogService.showAuthDialog(this.userNotRegisteredDialog, this.johnDoeDialog, this.userPendingTriesToChatDialog);
	}
}
