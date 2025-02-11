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
	editingTitle: ChatTitle | null = null;
	tempTitle: string = '';

	@Output() readonly conversationSelected = new EventEmitter<ChatTitle>();
	@Output() readonly conversationDeleted = new EventEmitter<ChatTitle>();
	@Input() titles!: ChatTitle[] | null;
	constructor(private readonly conversationService: ConversationService) {}

	titleSelected(title: ChatTitle): void {
		this.titles.forEach(t => (t.selected = false));
		title.selected = true;
		this.selected = title;
		this.conversationSelected.emit(this.selected);
	}

	deleteTitle(title: ChatTitle): void {
		this.conversationService.deleteConversation(title.conversationId).subscribe(() => {
			const index = this.titles.indexOf(title);
			if (index > -1) {
				this.titles.splice(index, 1);
			}
			this.conversationDeleted.emit(title);
		});
	}

	startRename(title: ChatTitle, event: Event): void {
		event.stopPropagation();
		this.editingTitle = title;
		this.tempTitle = title.title;
	}

	saveRename(title: ChatTitle): void {
		if (this.tempTitle.trim() && this.tempTitle !== title.title) {
			this.conversationService.renameConversation(title.conversationId, this.tempTitle)
				.subscribe(() => {
					title.title = this.tempTitle;
					this.editingTitle = null;
				});
		} else {
			this.editingTitle = null;
		}
	}

	cancelRename(): void {
		this.editingTitle = null;
	}
}
