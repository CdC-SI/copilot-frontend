import {ChangeDetectionStrategy, Component, HostListener, TemplateRef, ViewChild, inject, signal} from '@angular/core';
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

/** Page de chat : mise en page, dépôt/collage de pièces jointes, raccourci Échap et dialogues d'inscription. */
@Component({
	selector: 'zco-chat',
	templateUrl: './chat.component.html',
	styleUrls: ['./chat.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	providers: [ChatStore, ChatConversationsStore, ChatGenerationStore, ChatAttachmentsStore],
	imports: [
		AlertBannerComponent,
		ObColumnLayoutComponent,
		ChatSidebarComponent,
		ChatTimelineComponent,
		ChatComposerComponent,
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
	private readonly authDialogService = inject(UserAuthDialogService);
	private readonly dialog = inject(MatDialog);

	/** Échap arrête la génération en cours (sauf si une boîte de dialogue est ouverte). */
	@HostListener('document:keydown.escape')
	onEscape(): void {
		if (this.store.isGenerating() && !this.store.isStopping() && this.dialog.openDialogs.length === 0) {
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
