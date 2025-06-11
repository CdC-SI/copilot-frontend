import {Component, EventEmitter, Input, Output} from '@angular/core';
import {ChatMessage, ChatMessageSource} from '../../model/chat-message';
import {Feedback} from '../../model/feedback';
import {MessageSource} from '../../model/chat-history';
import {UploadService} from '../../services/upload.service';
import {ObNotificationService} from '@oblique/oblique';

@Component({
	selector: 'zco-chat-message',
	templateUrl: './chat-message.component.html',
	styleUrl: './chat-message.component.scss'
})
export class ChatMessageComponent {
	@Input() previousMessage: ChatMessage;
	@Input() message: ChatMessage;
	@Output() readonly feedback: EventEmitter<Feedback> = new EventEmitter<Feedback>();
	protected readonly ChatMessageSource = ChatMessageSource;

	constructor(
		private readonly uploadService: UploadService,
		private readonly notifService: ObNotificationService
	) {}

	sendFeedback(event: Feedback) {
		this.feedback.emit(event);
	}

	/**
	 * Returns the number of sources available for the current message
	 * @returns number of sources or 0 if no sources available
	 */
	get sourcesCount(): number {
		return this.message?.sources?.length || 0;
	}

	/**
	 * Checks if the message has any sources to display
	 * @returns true if message has one or more sources
	 */
	get hasMultipleSources(): boolean {
		return this.sourcesCount > 0;
	}

	downloadFile(source: MessageSource) {
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
