import {ChangeDetectionStrategy, ChangeDetectorRef, Component, DOCUMENT, DestroyRef, EventEmitter, Input, Output, inject} from '@angular/core';
import {ConversationService} from '../../services/conversation.service';
import {ChatTitle} from '../../model/chat-history';
import {MatList, MatListItem} from '@angular/material/list';
import {MatTooltip} from '@angular/material/tooltip';
import {MatIcon} from '@angular/material/icon';
import {MatIconButton} from '@angular/material/button';
import {MatInput} from '@angular/material/input';
import {FormsModule} from '@angular/forms';
import {DatePipe} from '@angular/common';
import {TranslatePipe} from '@ngx-translate/core';
import {ChatHistoryGroup, groupTitlesByPeriod, nextLocalMidnight} from './chat-history-groups';

@Component({
	selector: 'zco-chat-history',
	templateUrl: './chat-history.component.html',
	styleUrl: './chat-history.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [MatList, MatListItem, MatTooltip, MatIcon, MatIconButton, MatInput, FormsModule, DatePipe, TranslatePipe]
})
export class ChatHistoryComponent {
	editingTitle: ChatTitle | null = null;
	tempTitle: string = '';

	@Output() readonly conversationSelected = new EventEmitter<ChatTitle>();
	/** Conversation supprimée côté backend. */
	@Output() readonly conversationDeleted = new EventEmitter<ChatTitle>();
	/** Conversation renommée côté backend. */
	@Output() readonly conversationRenamed = new EventEmitter<{conversationId: string; title: string}>();
	/** Conversations regroupées par période (aujourd'hui, hier, 7 derniers jours, plus ancien). */
	groups: ChatHistoryGroup[] = [];
	@Input() set titles(titles: ChatTitle[] | null) {
		this.currentTitles = titles;
		this.regroup();
	}
	private readonly conversationService = inject(ConversationService);
	private readonly cdr = inject(ChangeDetectorRef);
	private readonly document = inject(DOCUMENT);
	private currentTitles: ChatTitle[] | null = null;
	private midnightTimer?: ReturnType<typeof setTimeout>;

	constructor() {
		// Onglet resté ouvert ou mis en veille : les périodes sont recalculées au retour, le minuit passé.
		const onVisible = (): void => {
			if (this.document.visibilityState === 'visible') this.regroup();
		};
		this.document.addEventListener('visibilitychange', onVisible);
		inject(DestroyRef).onDestroy(() => {
			clearTimeout(this.midnightTimer);
			this.document.removeEventListener('visibilitychange', onVisible);
		});
	}

	titleSelected(title: ChatTitle): void {
		this.conversationSelected.emit(title);
	}

	deleteTitle(title: ChatTitle): void {
		this.conversationService.deleteConversation(title.conversationId).subscribe(() => this.conversationDeleted.emit(title));
	}

	startRename(title: ChatTitle, event: Event): void {
		event.stopPropagation();
		this.editingTitle = title;
		this.tempTitle = title.title;
	}

	saveRename(title: ChatTitle): void {
		if (this.tempTitle.trim() && this.tempTitle !== title.title) {
			const newTitle = this.tempTitle;
			this.conversationService.renameConversation(title.conversationId, newTitle).subscribe(() => {
				this.editingTitle = null;
				this.conversationRenamed.emit({conversationId: title.conversationId, title: newTitle});
				this.cdr.markForCheck();
			});
		} else {
			this.editingTitle = null;
		}
	}

	cancelRename(): void {
		this.editingTitle = null;
	}

	/** Regroupe les conversations et planifie le regroupement suivant au prochain minuit local. */
	private regroup(): void {
		const now = new Date();
		this.groups = groupTitlesByPeriod(this.currentTitles, now);
		this.cdr.markForCheck();
		clearTimeout(this.midnightTimer);
		this.midnightTimer = setTimeout(() => this.regroup(), nextLocalMidnight(now).getTime() - now.getTime() + 1000);
	}
}
