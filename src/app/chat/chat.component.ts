import {ChangeDetectorRef, Component, OnInit, TemplateRef, ViewChild} from '@angular/core';
import {Observable, of} from 'rxjs';
import {FaqItemsService} from '../shared/services/faq-items.service';
import {FormControl, FormGroup} from '@angular/forms';
import {IQuestion, Language} from '../shared/model/answer';
import {RagService} from '../shared/services/rag.service';
import {
	AGENT_TAG_REGEX,
	ANCHOR_TAG_REGEX,
	INTENT_TAG_REGEX,
	MESSAGE_ID_REGEX,
	OFF_TOPIC_REGEX,
	RETRIEVING_TAG_REGEX,
	ROUTING_TAG_REGEX,
	SOURCE_TAG_REGEX,
	SUGGESTION_TAG_REGEX,
	TAGS_TAG_REGEX,
	TOOL_TAG_REGEX,
	TOPIC_CHECK_REGEX,
	clearNullAndEmpty
} from '../shared/utils/zco-utils';
import {ChatMessage, ChatMessageSource} from '../shared/model/chat-message';
import {SpeechService} from '../shared/services/speech.service';
import {ChatHistoryMessage, ChatTitle, MessageSource} from '../shared/model/chat-history';
import {ConversationService} from '../shared/services/conversation.service';
import {TranslateService} from '@ngx-translate/core';
import {Feedback} from '../shared/model/feedback';
import {FeedbackService} from '../shared/services/feedback.service';
import {ObNotificationService} from '@oblique/oblique';
import {Command, CommandService} from '../shared/services/command.service';
import {UploadService} from '../shared/services/upload.service';
import {SettingsEventService} from '../shared/services/settings-event.service';
import {UserStatus} from '../shared/model/user';
import {AuthenticationServiceV2} from '../shared/services/auth.service';
import {ActionId, FormDef} from '../shared/model/form-definition';
import {DynamicFormService} from '../shared/services/dynamic-form.service';
import {MatDialog} from '@angular/material/dialog';

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
	displayTextArea = false;
	defaultSuggestions = [
		{text: 'action_suggestions.translate', action: 'translate'},
		{text: 'action_suggestions.summarize', action: 'summarize'},
		{text: 'action_suggestions.explain', action: 'explain'},
		{text: 'action_suggestions.reformulate', action: 'reformulate'},
		{text: 'action_suggestions.draft', action: 'draft'}
	];
	specificSuggestions: {text: string; action: string}[] = [];
	activeForm?: {def: FormDef; group: FormGroup};

	@ViewChild('userNotRegisteredTriesToChatDialog') userNotRegisteredDialog: TemplateRef<any>;
	@ViewChild('userPendingTriesToChatDialog') userPendingTriesToChatDialog: TemplateRef<any>;

	protected readonly ChatMessageSource = ChatMessageSource;

	constructor(
		private readonly autocompleteService: FaqItemsService,
		private readonly ragService: RagService,
		private readonly cdr: ChangeDetectorRef,
		private readonly speechService: SpeechService,
		private readonly authService: AuthenticationServiceV2,
		private readonly conversationService: ConversationService,
		private readonly translateService: TranslateService,
		private readonly feedbackService: FeedbackService,
		private readonly notif: ObNotificationService,
		private readonly commandService: CommandService,
		private readonly uploadService: UploadService,
		private readonly settingsEventService: SettingsEventService,
		private readonly dfs: DynamicFormService,
		private readonly dialog: MatDialog
	) {}

	ngOnInit() {
		this.speechService.speechStartEvent.subscribe(() => {
			this.messages.forEach(message => {
				message.beingSpoken = false;
			});
		});
		this.authService.$authenticatedUser.subscribe(user => {
			if (user && user.status === UserStatus.ACTIVE) {
				this.getConversationTitles();
			}
		});
	}

	isRegistered(): boolean {
		return this.authService.isRegistered();
	}

	getOptionService() {
		return this.isCommandMode ? this.getCommandSuggestions : this.currentConversation ? () => of([]) : this.getSearchProposalFunction;
	}

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
			question.url ? [{type: this.getSourceType(question.url), link: question.url}] : undefined
		);
		this.clearSearch();
		this.scrollToBottom();
		this.updateCurrentConversation();
	}

	clearSearch(): void {
		this.searchCtrl.setValue('');
		this.displayTextArea = false;
	}

	disableSearch(): void {
		this.searchCtrl.disable();
	}

	enableSearch(): void {
		this.searchCtrl.enable();
	}

	newChat(): void {
		if (this.currentConversation) this.currentConversation.selected = false;
		this.currentConversation = null;
		this.messages = [];
		this.specificSuggestions = [];
	}

	sendToLLM(): void {
		if (!this.isRegistered()) {
			this.showDialog();
			return;
		}

		const inputText = this.searchCtrl.value;

		this.addMessage(ChatMessageSource.USER, inputText);
		this.addMessage(ChatMessageSource.LLM, '', false, false);
		this.disableSearch();
		this.specificSuggestions = [];

		const languageMap: Record<string, Language> = {
			de: Language.DE,
			fr: Language.FR,
			it: Language.IT
		};
		const currentLang = this.translateService.currentLang;
		const mappedLanguage = languageMap[currentLang] || Language.DE;

		// Handle the three mutually exclusive modes
		const requestConfig = {
			query: inputText,
			conversationId: this.currentConversation?.conversationId,
			...this.chatConfigCtrl.value,
			language: mappedLanguage
		};

		this.ragService.process(clearNullAndEmpty(requestConfig)).subscribe({
			next: chunk => {
				this.buildResponseWithLLMChunk(this.messages[this.messages.length - 1], chunk);
				this.cdr.markForCheck();
			},
			error: err => {
				if (err.message !== 'network error') {
					// TODO dirty fix to handle the 'error net::ERR_INCOMPLETE_CHUNKED_ENCODING' issue
					this.messages.pop();
					this.addMessage(ChatMessageSource.LLM, 'Une erreur est survenue. Veuillez réessayer.', true);
				}
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

		const intentTagMatch = INTENT_TAG_REGEX.exec(chunk);
		if (intentTagMatch) {
			partialChatMessage.message = intentTagMatch[1];
			partialChatMessage.isProcessingIntent = true;
			return;
		}

		const sourceTagMatch = SOURCE_TAG_REGEX.exec(chunk);
		if (sourceTagMatch) {
			partialChatMessage.message = sourceTagMatch[1];
			partialChatMessage.isProcessingSources = true;
			return;
		}

		const tagsTagMatch = TAGS_TAG_REGEX.exec(chunk);
		if (tagsTagMatch) {
			partialChatMessage.message = tagsTagMatch[1];
			partialChatMessage.isProcessingTags = true;
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
		if (
			partialChatMessage.isRetrieving ||
			partialChatMessage.isValidating ||
			partialChatMessage.isRouting ||
			partialChatMessage.isAgent ||
			partialChatMessage.isToolUse ||
			partialChatMessage.isProcessingIntent ||
			partialChatMessage.isProcessingSources ||
			partialChatMessage.isProcessingTags
		) {
			partialChatMessage.message = '';
			partialChatMessage.isRetrieving = false;
			partialChatMessage.isValidating = false;
			partialChatMessage.isRouting = false;
			partialChatMessage.isAgent = false;
			partialChatMessage.isToolUse = false;
			partialChatMessage.isProcessingIntent = false;
			partialChatMessage.isProcessingSources = false;
			partialChatMessage.isProcessingTags = false;
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
			const sourceFile = sourceMatch[2];
			const pageNumber = sourceMatch[3];
			const subSection = sourceMatch[4];
			const version = sourceMatch[5];

			const source: MessageSource = sourceUrl
				? {type: 'URL', link: sourceUrl, pageNumber, subsection: subSection, version}
				: {type: 'FILE', link: sourceFile, pageNumber, subsection: subSection, version};
			partialChatMessage.sources.push(source);

			// Remove entire source tag from message
			partialChatMessage.message = partialChatMessage.message.replace(sourceMatch[0], '');
		}

		const suggestionMatch = SUGGESTION_TAG_REGEX.exec(partialChatMessage.message);
		if (suggestionMatch) {
			partialChatMessage.message = partialChatMessage.message.replace(SUGGESTION_TAG_REGEX, '');
			this.specificSuggestions.push({text: `action_suggestions.${suggestionMatch[1]}`, action: suggestionMatch[1]});
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
		sources?: MessageSource[]
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
			this.specificSuggestions = this.messages[this.messages.length - 1].suggestions?.map(suggestion => {
				return {text: `action_suggestions.${suggestion}`, action: suggestion};
			});
			this.scrollToBottom();
		});
	}

	deleteConversation(conversation: ChatTitle) {
		if (conversation.conversationId === this.currentConversation?.conversationId) {
			this.currentConversation = null;
			this.messages = [];
			this.specificSuggestions = [];
		}
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
	uploadDoc(): void {
		const fileInput = document.createElement('input');
		fileInput.type = 'file';
		fileInput.accept = '.pdf';

		fileInput.onchange = (e: Event) => {
			const file = (e.target as HTMLInputElement).files?.[0];
			if (file) {
				this.uploadService.uploadPersonalPdf(file, this.currentConversation?.conversationId).subscribe({
					next: () => {
						this.notif.success('upload.success');
						this.settingsEventService.emitSettingsRefresh();
					},
					error: err => {
						if (err.statusText === 'Unknown Error') {
							this.notif.error('upload.error');
						} else {
							this.notif.error(err.error['MESSAGE']);
						}
					}
				});
			}
		};

		fileInput.click();
	}

	handleSuggestionAction(action: string): void {
		if (action === 'ii-salary') {
			this.activeForm = this.dfs.buildForm(ActionId.II_CALCUL);
			const lastAssistant = this.messages[this.messages.length - 1];
			const patch = this.dfs.parseAssistantMessage(this.activeForm.def, lastAssistant.message);
			this.activeForm.group.patchValue(patch, {emitEvent: false});
		} else {
			const prefix = this.translateService.instant(`action_suggestions.prefixes.${action}`);
			this.searchCtrl.setValue(prefix);
		}
	}

	onFormSubmit() {
		const {def, group} = this.activeForm;
		const raw = group.getRawValue();
		const message = this.dfs.hydrate(def, raw);
		this.activeForm = undefined;
		this.searchCtrl.setValue(message);
		this.sendToLLM();
	}

	onCloseForm() {
		this.activeForm = undefined;
	}

	private getSourceType(url: string) {
		return url.startsWith('http') ? 'URL' : 'FILE';
	}

	private readonly getCommandSuggestions = (text: string): Observable<Command[]> => {
		return this.isCommandMode ? this.commandService.searchCommands(text) : of([]);
	};
	private readonly getSearchProposalFunction = (text: string): Observable<IQuestion[]> => {
		return this.isCommandMode ? of([]) : this.autocompleteService.search(text);
	};

	private historyMessageToChatMessage(historyMessage: ChatHistoryMessage): ChatMessage {
		return {
			id: historyMessage.messageId,
			message: historyMessage.message,
			source: historyMessage.role.toUpperCase() === 'USER' ? ChatMessageSource.USER : ChatMessageSource.LLM,
			isCompleted: true,
			timestamp: historyMessage.timestamp,
			lang: historyMessage.language,
			faqItemId: historyMessage.faqItemId,
			sources: historyMessage.sources,
			suggestions: historyMessage.suggestions
		};
	}

	private updateCurrentConversation() {
		if (!this.isRegistered()) return;
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

	private showDialog() {
		if (this.authService.userStatus() === UserStatus.GUEST) {
			this.dialog.open(this.userNotRegisteredDialog);
		} else {
			this.dialog.open(this.userPendingTriesToChatDialog);
		}
	}
}
