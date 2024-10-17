import {Component, Input} from '@angular/core';
import {ChatMessage, ChatMessageSource} from '../../services/chat-message';

@Component({
	selector: 'zco-chat-message',
	templateUrl: './chat-message.component.html',
	styleUrl: './chat-message.component.scss'
})
export class ChatMessageComponent {
	@Input() previousMessage: ChatMessage;
	@Input() message: ChatMessage;
	protected readonly ChatMessageSource = ChatMessageSource;
}
