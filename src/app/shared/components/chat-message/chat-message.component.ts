import {Component, EventEmitter, Input, Output} from '@angular/core';
import {ChatMessage, ChatMessageSource} from '../../model/chat-message';
import {Feedback} from '../../model/feedback';

@Component({
	selector: 'zco-chat-message',
	templateUrl: './chat-message.component.html',
	styleUrl: './chat-message.component.scss'
})
export class ChatMessageComponent {
	@Input() previousMessage: ChatMessage;
	@Input() message: ChatMessage;
	@Input() conversationId: string;
	/** Message appartenant au dernier échange, qui peut être régénéré (réponse) ou modifié (question). */
	@Input() replayable = false;
	@Output() readonly feedback: EventEmitter<Feedback> = new EventEmitter<Feedback>();
	@Output() readonly workspaceChange = new EventEmitter<{question: string; workspace: string}>();
	@Output() readonly regenerate = new EventEmitter<void>();
	@Output() readonly editQuestion = new EventEmitter<string>();
	sourcePanelOpen: boolean;
	editing = false;
	editedQuestion = '';
	protected readonly ChatMessageSource = ChatMessageSource;

	constructor() {}

	sendFeedback(event: Feedback) {
		this.feedback.emit(event);
	}

	startEdit(): void {
		this.editedQuestion = this.message.message ?? '';
		this.editing = true;
	}

	cancelEdit(): void {
		this.editing = false;
	}

	submitEdit(): void {
		const question = this.editedQuestion.trim();
		if (!question) return;
		this.editing = false;
		if (question !== this.message.message) {
			this.editQuestion.emit(question);
		}
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
}
