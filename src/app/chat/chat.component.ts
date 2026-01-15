import {ChangeDetectorRef, Component, OnInit, TemplateRef, ViewChild} from '@angular/core';
import {FormControl, FormGroup} from '@angular/forms';
import {IQuestion, Language} from '../shared/model/answer';
import {RagService} from '../shared/services/rag.service';
import {clearNullAndEmpty} from '../shared/utils/zco-utils';
import {ChatMessage, ChatMessageSource} from '../shared/model/chat-message';
import {SpeechService} from '../shared/services/speech.service';
import {ChatTitle} from '../shared/model/chat-history';
import {ConversationService} from '../shared/services/conversation.service';
import {TranslateService} from '@ngx-translate/core';
import {Feedback} from '../shared/model/feedback';
import {FeedbackService} from '../shared/services/feedback.service';
import {ObNotificationService} from '@oblique/oblique';
import {UserStatus} from '../shared/model/user';
import {AuthenticationServiceV2} from '../shared/services/auth.service';
import {FormDef} from '../shared/model/form-definition';
import {DynamicFormService} from '../shared/services/dynamic-form.service';
import {
	AutocompleteType,
	ChatAutocompleteService,
	ChatConversationManagerService,
	ChatFileUploadService,
	ChatStreamProcessorService,
	ChatSuggestionService,
	LANGUAGE_MAP,
	UserAuthDialogService
} from './services';

@Component({
	selector: 'zco-chat',
	templateUrl: './chat.component.html',
	styleUrls: ['./chat.component.scss']
})
export class ChatComponent implements OnInit {
	Object = Object;
	searchCtrl = new FormControl();
	chatConfigCtrl = new FormControl();
	conversationTitles: ChatTitle[] = [];
	currentConversation: ChatTitle;
	isCommandMode = false;
	displayTextArea = false;
	activeForm?: {def: FormDef; group: FormGroup};
	attachments: File[] = [];
	@ViewChild('userNotRegisteredTriesToChatDialog') userNotRegisteredDialog: TemplateRef<any>;
	@ViewChild('userPendingTriesToChatDialog') userPendingTriesToChatDialog: TemplateRef<any>;
	@ViewChild('johnDoeInfoDialog') johnDoeDialog: TemplateRef<any>;
	protected readonly ChatMessageSource = ChatMessageSource;

	get messages(): ChatMessage[] {
		return this.conversationManager.getMessages(this.currentConversation?.conversationId);
	}

	get defaultSuggestions() {
		return this.suggestionService.getDefaultSuggestions();
	}

	get specificSuggestions() {
		return this.suggestionService.getSpecificSuggestions();
	}

	constructor(
		private readonly ragService: RagService,
		private readonly cdr: ChangeDetectorRef,
		private readonly speechService: SpeechService,
		private readonly authService: AuthenticationServiceV2,
		private readonly conversationService: ConversationService,
		private readonly translateService: TranslateService,
		private readonly feedbackService: FeedbackService,
		private readonly notif: ObNotificationService,
		private readonly dfs: DynamicFormService,
		private readonly streamProcessor: ChatStreamProcessorService,
		private readonly conversationManager: ChatConversationManagerService,
		private readonly suggestionService: ChatSuggestionService,
		private readonly autocompleteService: ChatAutocompleteService,
		private readonly authDialogService: UserAuthDialogService,
		private readonly fileUploadService: ChatFileUploadService
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
		return this.authDialogService.isRegistered();
	}

	getOptionService() {
		return this.autocompleteService.getOptionService(this.isCommandMode, !!this.currentConversation);
	}

	searchOptionLabelFn = (option: AutocompleteType): string => {
		return this.autocompleteService.getOptionLabel(option, this.isCommandMode);
	};

	handleOptionSelected(value: AutocompleteType): void {
		if (this.autocompleteService.isCommand(value)) {
			this.searchCtrl.setValue(value.name);
		} else {
			this.selectFaqOption(value);
		}
	}

	selectFaqOption(question: IQuestion): void {
		const sourceType = question.url?.startsWith('http') ? 'URL' : 'FILE';
		this.conversationManager.addMessage(
			this.currentConversation?.conversationId,
			ChatMessageSource.USER,
			question.text,
			false,
			true,
			question.language,
			question.id
		);
		this.conversationManager.addMessage(
			this.currentConversation?.conversationId,
			ChatMessageSource.FAQ,
			question.answer.text,
			false,
			true,
			question.language,
			question.id,
			question.url,
			question.url ? [{type: sourceType, link: question.url}] : undefined
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
		this.conversationManager.initNewChat();
		this.suggestionService.clearSpecificSuggestions();
	}

	sendToLLM(): void {
		if (!this.isRegistered()) {
			this.showDialog();
			return;
		}

		const inputText = this.searchCtrl.value;
		this.prepareForStreaming(inputText);
		this.startStreamingRequest(inputText);
		this.clearSearchAndAttachments();
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
			const chatMessages = messages.map(msg => this.conversationManager.historyMessageToChatMessage(msg));
			this.conversationManager.setConversationMessages(conversation.conversationId, chatMessages);
			this.suggestionService.setSpecificSuggestionsFromMessages(chatMessages);
			this.scrollToBottom();
		});
	}

	deleteConversation(conversation: ChatTitle) {
		if (conversation.conversationId === this.currentConversation?.conversationId) {
			this.currentConversation = null;
			this.conversationManager.initNewChat();
			this.suggestionService.clearSpecificSuggestions();
		}
		this.conversationManager.deleteConversation(conversation.conversationId);
	}

	getConversationTitles() {
		this.conversationService.getConversationTitles().subscribe(conversations => {
			this.setAndSortConversations(conversations);
		});
	}

	sendFeedback(feedback: Feedback) {
		this.feedbackService.sendAnswerFeedback({conversationId: this.currentConversation.conversationId, ...feedback}).subscribe(() => {
			this.notif.success('feedback.success');
		});
	}
	uploadDoc(): void {
		this.fileUploadService.uploadDocument(this.currentConversation?.conversationId);
	}

	handleSuggestionAction(action: string): void {
		const result = this.suggestionService.handleSuggestionAction(action, this.messages);

		if (result.shouldShowForm) {
			this.activeForm = {
				def: result.formDef,
				group: result.formGroup
			};
		} else if (result.searchValue) {
			this.searchCtrl.setValue(result.searchValue);
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

	onAttachmentsSelected(event: File[]) {
		this.attachments.push(...event);
	}

	removeAttachment(index: number) {
		this.attachments.splice(index, 1);
	}

	private prepareForStreaming(inputText: string): void {
		this.conversationManager.setActiveStreamingConversation(this.currentConversation?.conversationId);
		this.conversationManager.addMessage(this.currentConversation?.conversationId, ChatMessageSource.USER, inputText);
		this.conversationManager.addMessage(this.currentConversation?.conversationId, ChatMessageSource.LLM, '', false, false);
		this.disableSearch();
		this.suggestionService.clearSpecificSuggestions();
	}

	private startStreamingRequest(inputText: string): void {
		const currentLang = this.translateService.currentLang;
		const mappedLanguage = LANGUAGE_MAP[currentLang] || Language.DE;

		const requestConfig = {
			query: inputText,
			attachments: this.attachments,
			conversationId: this.currentConversation?.conversationId,
			...this.chatConfigCtrl.value,
			language: mappedLanguage
		};

		this.ragService.process(clearNullAndEmpty(requestConfig)).subscribe({
			next: chunk => {
				this.processStreamChunk(chunk);
				this.cdr.markForCheck();
			},
			error: err => {
				this.handleStreamError(err);
			},
			complete: () => {
				this.conversationManager.clearActiveStreamingConversation();
			}
		});
	}

	private clearSearchAndAttachments(): void {
		this.clearSearch();
		this.attachments = [];
	}

	private processStreamChunk(chunk: string): void {
		const streamingMessages = this.conversationManager.getStreamingMessages();
		if (!streamingMessages || streamingMessages.length === 0) return;

		const partialChatMessage = streamingMessages.at(-1);
		if (!partialChatMessage) return;

		const result = this.streamProcessor.processChunk(chunk, partialChatMessage);

		if (result.hasNewSuggestion && result.newSuggestion) {
			this.suggestionService.addSpecificSuggestion(result.newSuggestion);
		}

		if (result.shouldEnableSearch) {
			this.enableSearch();
		}

		if (result.shouldRefreshConversations && !this.currentConversation) {
			this.refreshConversations();
		}
	}

	private handleStreamError(err: any): void {
		if (err.message !== 'network error') {
			const streamingMessages = this.conversationManager.getStreamingMessages();
			if (streamingMessages) {
				streamingMessages.pop();
				streamingMessages.push({
					message: 'Une erreur est survenue. Veuillez réessayer.',
					source: ChatMessageSource.LLM,
					timestamp: new Date(),
					isCompleted: true,
					inError: true,
					beingSpoken: false,
					sources: []
				});
			}
		}
		this.conversationManager.clearActiveStreamingConversation();
		this.enableSearch();
	}

	private updateCurrentConversation() {
		if (!this.isRegistered()) return;
		if (this.currentConversation) {
			this.conversationService.update(this.currentConversation.conversationId, [this.messages.at(-2), this.messages.at(-1)]);
		} else {
			this.conversationService.init(this.messages).subscribe(() => {
				this.refreshConversations();
			});
		}
	}

	private refreshConversations() {
		setTimeout(() => {
			this.conversationService.getConversationTitles().subscribe(conversations => {
				this.setAndSortConversations(conversations);
				this.currentConversation = this.conversationTitles[0];
				this.currentConversation.selected = true;
				// Transfer messages from NEW_CHAT_KEY to the new conversation
				this.conversationManager.transferNewChatToConversation(this.currentConversation.conversationId);
			});
		}, 1_500);
	}

	private setAndSortConversations(conversations: ChatTitle[]) {
		conversations.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
		this.conversationTitles = conversations;
	}

	private showDialog() {
		this.authDialogService.showAuthDialog(this.userNotRegisteredDialog, this.johnDoeDialog, this.userPendingTriesToChatDialog);
	}
}
