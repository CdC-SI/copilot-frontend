import {Component, EventEmitter, Input, OnInit, Output} from '@angular/core';
import {ConversationService} from '../../services/conversation.service';
import {ChatTitle} from '../../model/chat-history';

@Component({
	selector: 'zco-chat-history',
	templateUrl: './chat-history.component.html',
	styleUrl: './chat-history.component.scss'
})
export class ChatHistoryComponent {
	selected: ChatTitle;

	@Output() readonly conversationSelected = new EventEmitter<ChatTitle>();
	@Input() titles!: ChatTitle[] | null;
	constructor(private readonly conversationService: ConversationService) {}

	titleSelected(title: ChatTitle): void {
		this.titles.forEach(t => (t.selected = false));
		title.selected = true;
		this.selected = title;
		this.conversationSelected.emit(this.selected);
	}
}
