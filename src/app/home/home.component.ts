import {ChangeDetectorRef, Component, OnInit, Renderer2} from '@angular/core';
import {FaqItemsService} from '../shared/services/faq-items.service';
import {FormControl} from '@angular/forms';
import {IQuestion, Language} from '../shared/model/answer';
import {RagService} from '../shared/services/rag.service';
import {ANCHOR_TAG_REGEX, MESSAGE_ID_REGEX, clearNullAndEmpty} from '../shared/utils/zco-utils';
import {ChatMessage, ChatMessageSource} from '../shared/model/chat-message';
import {SpeechService} from '../shared/services/speech.service';
import {UserService} from '../shared/services/user.service';
import {ChatHistoryMessage, ChatTitle} from '../shared/model/chat-history';
import {ConversationService} from '../shared/services/conversation.service';
import {TranslateService} from '@ngx-translate/core';
import {Feedback} from '../shared/model/feedback';
import {FeedbackService} from '../shared/services/feedback.service';
import {ObNotificationService} from '@oblique/oblique';

@Component({
	selector: 'zco-home',
	templateUrl: './home.component.html',
	styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {
	Object = Object;
	searchCtrl = new FormControl();
	chatConfigCtrl = new FormControl();
	messages: ChatMessage[] = [];
	conversationTitles: ChatTitle[] = [];
	currentConversation: ChatTitle;

	protected readonly ChatMessageSource = ChatMessageSource;

	constructor(
		private readonly autocompleteService: FaqItemsService,
		private readonly ragService: RagService,
		private readonly cdr: ChangeDetectorRef,
		private readonly renderer: Renderer2,
		private readonly speechService: SpeechService,
		private readonly userService: UserService,
		private readonly conversationService: ConversationService,
		private readonly translateService: TranslateService,
		private readonly feedbackService: FeedbackService,
		private readonly notif: ObNotificationService
	) {}

	ngOnInit() {
		this.speechService.speechStartEvent.subscribe(() => {
			this.messages.forEach(message => {
				message.beingSpoken = false;
			});
		});
		if (this.isAuthenticated()) {
			this.getConversationTitles();
		}
		this.userService.userLoggedIn.subscribe(() => {
			this.getConversationTitles();
		});
	}

	isAuthenticated(): boolean {
		return this.userService.isAuthenticated();
	}

	closeRightPanel() {
		const element = document.querySelector('.ob-column-right');
		if (element) {
			this.renderer.addClass(element, 'ob-collapsed');
		}
	}

	getSearchProposalFunction = (text: string) => {
		return this.autocompleteService.search(text);
	};
	searchOptionLabelFn = (question: IQuestion): string => question?.text ?? '';

	selectFaqOption(question: IQuestion): void {
		this.addMessage(ChatMessageSource.USER, question.text, false, true, question.language, question.id);
		this.addMessage(ChatMessageSource.FAQ, question.answer.text, false, true, question.language, question.id, question.url);
		this.clearSearch();
		this.scrollToBottom();
		this.updateCurrentConversation();
	}

	clearSearch(): void {
		this.searchCtrl.setValue('');
	}

	disableSearch(): void {
		this.searchCtrl.disable();
	}

	enableSearch(): void {
		this.searchCtrl.enable();
	}

	clearChat(): void {
		this.messages = [];
	}

	newChat(): void {
		if (this.currentConversation) this.currentConversation.selected = false;
		this.currentConversation = null;
		this.clearChat();
	}

	sendToLLM(): void {
		this.addMessage(ChatMessageSource.USER, this.searchCtrl.value);
		this.addMessage(ChatMessageSource.LLM, '', false, false);
		this.disableSearch();
		this.ragService
			.process(
				clearNullAndEmpty({
					query: this.searchCtrl.value,
					conversationId: this.currentConversation?.conversationId,
					language: this.translateService.currentLang,
					...this.chatConfigCtrl.value
				})
			)
			.subscribe({
				next: chunk => {
					this.buildResponseWithLLMChunk(this.messages[this.messages.length - 1], chunk);
					this.cdr.markForCheck();
				},
				error: () => {
					this.messages.pop();
					this.addMessage(ChatMessageSource.LLM, 'Une erreur est survenue. Veuillez réessayer.', true);
					this.enableSearch();
				}
			});

		this.clearSearch();
	}

	buildResponseWithLLMChunk(partialChatMessage: ChatMessage, chunk: string): void {
		if (!chunk) return;

		partialChatMessage.message += chunk;
		const anchorTagMatch = ANCHOR_TAG_REGEX.exec(partialChatMessage.message);
		const messageIdTagMatch = MESSAGE_ID_REGEX.exec(partialChatMessage.message);
		if (anchorTagMatch) {
			partialChatMessage.message = partialChatMessage.message.replace(ANCHOR_TAG_REGEX, '');
			partialChatMessage.url = anchorTagMatch[1];
			partialChatMessage.isCompleted = true;
			this.scrollToBottom();
			this.enableSearch();
		}
		if (messageIdTagMatch) {
			partialChatMessage.message = partialChatMessage.message.replace(MESSAGE_ID_REGEX, '');
			partialChatMessage.id = messageIdTagMatch[1];
			if (!this.currentConversation) {
				this.refreshConversations();
			}
		}
	}

	addMessage(source: ChatMessageSource, message: string, inError = false, isCompleted = true, lang?: Language, faqItemId?: number, url?: string) {
		this.messages.push({faqItemId, message, source, isCompleted, timestamp: new Date(), lang, url, inError, beingSpoken: false});
	}

	scrollToBottom(): void {
		setTimeout(() => {
			const mainContainer = document.querySelector('.message-container');
			if (mainContainer) {
				mainContainer.scrollTop = mainContainer.scrollHeight;
			}
		});
	}

	selectConversation(conversation: ChatTitle) {
		this.conversationService.getConversation(conversation.conversationId).subscribe(messages => {
			this.currentConversation = conversation;
			this.messages = messages.map(this.historyMessageToChatMessage);
			this.scrollToBottom();
		});
	}
	getConversationTitles() {
		this.conversationService.getConversationTitles().subscribe(conversations => {
			this.conversationTitles = conversations;
		});
	}

	sendFeedback(feedback: Feedback) {
		this.feedbackService.sendFeeback({conversationId: this.currentConversation.conversationId, ...feedback}).subscribe(() => {
			this.notif.success('feedback.success');
		});
	}

	private historyMessageToChatMessage(historyMessage: ChatHistoryMessage): ChatMessage {
		return {
			id: historyMessage.messageId,
			message: historyMessage.message,
			source: historyMessage.role.toUpperCase() === 'USER' ? ChatMessageSource.USER : ChatMessageSource.LLM,
			isCompleted: true,
			timestamp: historyMessage.timestamp,
			lang: historyMessage.language,
			url: historyMessage.url,
			faqItemId: historyMessage.faqItemId
		};
	}

	private updateCurrentConversation() {
		if (!this.isAuthenticated()) return;
		if (!this.currentConversation) {
			this.conversationService.init(this.messages).subscribe(() => {
				this.refreshConversations();
			});
		} else {
			this.conversationService.update(this.currentConversation.conversationId, [
				this.messages[this.messages.length - 2],
				this.messages[this.messages.length - 1]
			]);
		}
	}

	private refreshConversations() {
		setTimeout(() => {
			this.conversationService.getConversationTitles().subscribe(conversations => {
				this.conversationTitles = conversations;
				this.currentConversation = conversations[conversations.length - 1];
				this.currentConversation.selected = true;
			});
		}, 1_500);
	}
}
