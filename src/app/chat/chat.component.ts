import {ChangeDetectorRef, Component, OnInit, Renderer2} from '@angular/core';
import {Observable, of} from 'rxjs';  // Add this import
import {FaqItemsService} from '../shared/services/faq-items.service';
import {FormControl} from '@angular/forms';
import {IQuestion, Language} from '../shared/model/answer';
import {RagService} from '../shared/services/rag.service';
import {ANCHOR_TAG_REGEX, MESSAGE_ID_REGEX, RETRIEVING_TAG_REGEX, TOPIC_CHECK_REGEX, OFF_TOPIC_REGEX, clearNullAndEmpty, ROUTING_TAG_REGEX, AGENT_TAG_REGEX, TOOL_TAG_REGEX} from '../shared/utils/zco-utils';
import {ChatMessage, ChatMessageSource} from '../shared/model/chat-message';
import {SpeechService} from '../shared/services/speech.service';
import {UserService} from '../shared/services/user.service';
import {ChatHistoryMessage, ChatTitle} from '../shared/model/chat-history';
import {ConversationService} from '../shared/services/conversation.service';
import {TranslateService} from '@ngx-translate/core';
import {Feedback} from '../shared/model/feedback';
import {FeedbackService} from '../shared/services/feedback.service';
import {ObNotificationService} from '@oblique/oblique';
import {CommandService, Command} from '../shared/services/command.service';
import { UploadService } from '../shared/services/upload.service';

type AutocompleteType = IQuestion | Command;

@Component({
	selector: 'zco-chat',
	templateUrl: './chat.component.html',
	styleUrls: ['./chat.component.scss']
})
export class ChatComponent implements OnInit {
	Object = Object;
	searchCtrl = new FormControl();
	chatConfigCtrl = new FormControl();
	messages: ChatMessage[] = [];
	conversationTitles: ChatTitle[] = [];
	currentConversation: ChatTitle;
	isCommandMode = false;

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
		private readonly notif: ObNotificationService,
		private readonly commandService: CommandService,
		private readonly uploadService: UploadService
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

	getSearchProposalFunction = (text: string): Observable<IQuestion[]> => {
		return this.isCommandMode ? of([]) : this.autocompleteService.search(text);
	};

	getCommandSuggestions = (text: string): Observable<Command[]> => {
		return this.isCommandMode ? this.commandService.searchCommands(text) : of([]);
	};

	searchOptionLabelFn = (option: AutocompleteType): string => {
		if (this.isCommandMode && 'name' in option) {
			return option.name;
		}
		return (option as IQuestion)?.text ?? '';
	};

	handleOptionSelected(value: AutocompleteType): void {
		if (this.isCommandMode && 'name' in value) {
			this.searchCtrl.setValue(value.name);
		} else {
			this.selectFaqOption(value as IQuestion);
		}
	}

	selectFaqOption(question: IQuestion): void {
		this.addMessage(ChatMessageSource.USER, question.text, false, true, question.language, question.id);
		this.addMessage(
			ChatMessageSource.FAQ,
			question.answer.text,
			false,
			true,
			question.language,
			question.id,
			question.url,
			question.url ? [question.url] : undefined
		);
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
		const inputText = this.searchCtrl.value;
		const commandData = this.commandService.parseCommand(inputText);

		this.addMessage(ChatMessageSource.USER, inputText);
		this.addMessage(ChatMessageSource.LLM, '', false, false);
		this.disableSearch();

		const languageMap: Record<string, Language> = {
			'de': Language.DE,
			'fr': Language.FR,
			'it': Language.IT
		};
		const currentLang = this.translateService.currentLang;
		const mappedLanguage = languageMap[currentLang as keyof typeof languageMap] || Language.DE;

		// Handle the three mutually exclusive modes
		const requestConfig = {
			query: inputText,
			conversationId: this.currentConversation?.conversationId,
			...this.chatConfigCtrl.value,
			language: mappedLanguage,
			command: commandData?.command || null,
			commandArgs: commandData?.args || null,
			rag: commandData ? false : (this.chatConfigCtrl.value?.rag || false),
			agenticRag: commandData ? false : (this.chatConfigCtrl.value?.agenticRag || false),
			sourceValidation: this.chatConfigCtrl.value?.sourceValidation || false,
			topicCheck: this.chatConfigCtrl.value?.topicCheck || false
		};

		this.ragService
			.process(clearNullAndEmpty(requestConfig))
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

		const toolTagMatch = TOOL_TAG_REGEX.exec(chunk);
		if (toolTagMatch) {
			partialChatMessage.message = toolTagMatch[1];
			partialChatMessage.isToolUse = true;
			return;
		}

		const agentTagMatch = AGENT_TAG_REGEX.exec(chunk);
		if (agentTagMatch) {
			partialChatMessage.message = agentTagMatch[1];
			partialChatMessage.isAgent = true;
			return;
		}

		const routingTagMatch = ROUTING_TAG_REGEX.exec(chunk);
		if (routingTagMatch) {
			partialChatMessage.message = routingTagMatch[1];
			partialChatMessage.isRouting = true;
			return;
		}

		const topicCheckMatch = TOPIC_CHECK_REGEX.exec(chunk);
		if (topicCheckMatch) {
			partialChatMessage.message = topicCheckMatch[1];
			partialChatMessage.isValidating = true;
			return;
		}

		const offTopicMatch = OFF_TOPIC_REGEX.exec(chunk);
		if (offTopicMatch) {
			// Remove validation message and handle off-topic response
			partialChatMessage.isValidating = false;
			return;
		}

		const retrievingTagMatch = RETRIEVING_TAG_REGEX.exec(chunk);
		if (retrievingTagMatch) {
			partialChatMessage.message = retrievingTagMatch[1];
			partialChatMessage.isRetrieving = true;
			return;
		}

		// If we were in retrieving/validating/routing/agent state, clear the message before adding new content
		if (partialChatMessage.isRetrieving || partialChatMessage.isValidating || partialChatMessage.isRouting || partialChatMessage.isAgent || partialChatMessage.isToolUse) {
			partialChatMessage.message = '';
			partialChatMessage.isRetrieving = false;
			partialChatMessage.isValidating = false;
			partialChatMessage.isRouting = false;
			partialChatMessage.isAgent = false;
			partialChatMessage.isToolUse = false;
		}

		partialChatMessage.message += chunk;

		 // Initialize sources array if needed
		if (!partialChatMessage.sources) {
			partialChatMessage.sources = [];
		}

		// Collect all sources from current message content
		let sourceMatch;
		while ((sourceMatch = ANCHOR_TAG_REGEX.exec(partialChatMessage.message)) !== null) {
			 // Only store the URL
			const sourceUrl = sourceMatch[1];
			if (!partialChatMessage.sources.includes(sourceUrl)) {
				partialChatMessage.sources.push(sourceUrl);
			}
			// Remove entire source tag from message
			partialChatMessage.message = partialChatMessage.message.replace(sourceMatch[0], '');
		}

		const messageIdTagMatch = MESSAGE_ID_REGEX.exec(partialChatMessage.message);
		if (messageIdTagMatch) {
			partialChatMessage.message = partialChatMessage.message.replace(MESSAGE_ID_REGEX, '');
			partialChatMessage.id = messageIdTagMatch[1];
			partialChatMessage.isCompleted = true;
			this.enableSearch();
			if (!this.currentConversation) {
				this.refreshConversations();
			}
		}
	}

	addMessage(
		source: ChatMessageSource,
		message: string,
		inError = false,
		isCompleted = true,
		lang?: Language,
		faqItemId?: number,
		url?: string,
		sources?: string[]
	) {
		this.messages.push({
			faqItemId,
			message,
			source,
			isCompleted,
			timestamp: new Date(),
			lang,
			url,
			inError,
			beingSpoken: false,
			sources: sources || []
		});
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

	uploadDoc(): void {
		const fileInput = document.createElement('input');
		fileInput.type = 'file';
		fileInput.accept = '.pdf';

		fileInput.onchange = (e: Event) => {
			const file = (e.target as HTMLInputElement).files?.[0];
			if (file) {
				this.uploadService.uploadPdf(file).subscribe({
					next: () => {
						this.notif.success('Document uploaded successfully');
					},
					error: () => {
						this.notif.error('Error uploading document');
					}
				});
			}
		};

		fileInput.click();
	}
}
