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
	@Output() readonly feedback: EventEmitter<Feedback> = new EventEmitter<Feedback>();
	protected readonly ChatMessageSource = ChatMessageSource;

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
}
