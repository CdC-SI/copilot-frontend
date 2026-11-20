import {ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject} from '@angular/core';
import {ConversationService} from '../../services/conversation.service';
import {ChatTitle, ConversationType} from '../../model/chat-history';
import {MatList, MatListItem} from '@angular/material/list';
import {MatTooltip} from '@angular/material/tooltip';
import {MatIcon} from '@angular/material/icon';
import {MatIconButton} from '@angular/material/button';
import {MatInput} from '@angular/material/input';
import {FormsModule} from '@angular/forms';
import {DatePipe} from '@angular/common';
import {TranslatePipe} from '@ngx-translate/core';

@Component({
	selector: 'zco-chat-history',
	templateUrl: './chat-history.component.html',
	styleUrl: './chat-history.component.scss',
	changeDetection: ChangeDetectionStrategy.Eager,
	imports: [MatList, MatListItem, MatTooltip, MatIcon, MatIconButton, MatInput, FormsModule, DatePipe, TranslatePipe]
})
export class ChatHistoryComponent {
	selected: ChatTitle;
	editingTitle: ChatTitle | null = null;
	tempTitle: string = '';

	@Output() readonly conversationSelected = new EventEmitter<ChatTitle>();
	@Output() readonly conversationDeleted = new EventEmitter<ChatTitle>();
	@Input() titles!: ChatTitle[] | null;
	private readonly conversationService = inject(ConversationService);

	/** Icône représentant le type de conversation : Corpus documentaire (book) ou LLM seul (lightning). */
	getTypeIcon(title: ChatTitle): string {
		return title.type === ConversationType.NO_RAG ? 'lightning' : 'book';
	}

	/** Libellé accessible/tooltip associé à l'icône de type de conversation. */
	getTypeLabel(title: ChatTitle): string {
		return title.type === ConversationType.NO_RAG ? 'chat.new-conversation-llm-only.short-tooltip' : 'chat.new-conversation.short-tooltip';
	}

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
			this.conversationService.renameConversation(title.conversationId, this.tempTitle).subscribe(() => {
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
