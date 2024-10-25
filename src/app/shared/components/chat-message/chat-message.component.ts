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
}
