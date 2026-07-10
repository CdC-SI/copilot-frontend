import {AfterViewInit, ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, QueryList, TemplateRef, ViewChild, ViewChildren} from '@angular/core';
import {FormControl, FormGroup} from '@angular/forms';
import {IQuestion, Language} from '../shared/model/answer';
import {RagService} from '../shared/services/rag.service';
import {clearNullAndEmpty} from '../shared/utils/zco-utils';
import {ChatMessage, ChatMessageSource} from '../shared/model/chat-message';
import {SpeechService} from '../shared/services/speech.service';
import {Attachment, AttachmentDTO, AttachmentStatus, AttachmentUploadResponse, ChatTitle, ConversationType} from '../shared/model/chat-history';
import {ConversationService} from '../shared/services/conversation.service';
import {TranslateService} from '@ngx-translate/core';
import {Feedback} from '../shared/model/feedback';
import {FeedbackService} from '../shared/services/feedback.service';
import {ObNotificationService} from '@oblique/oblique';
import {UserStatus} from '../shared/model/user';
import {AuthenticationServiceV2} from '../shared/services/auth.service';
import {FormDef} from '../shared/model/form-definition';
import {DynamicFormService} from '../shared/services/dynamic-form.service';
import {HttpEventType} from '@angular/common/http';
import {
	AutocompleteType,
	ChatAutocompleteService,
	ChatConversationManagerService,
	ChatStreamProcessorService,
	ChatSuggestionService,
	LANGUAGE_MAP,
	UserAuthDialogService
} from './services';
import {Subject, merge, switchMap, take, takeUntil, takeWhile, timer} from 'rxjs';

const ATTACHMENT_POLL_INTERVAL_MS = 10_000;
const ATTACHMENT_POLL_MAX_ATTEMPTS = 15;

@Component({
	selector: 'zco-chat',
	templateUrl: './chat.component.html',
	styleUrls: ['./chat.component.scss']
})
export class ChatComponent implements OnInit, AfterViewInit, OnDestroy {
	Object = Object;
	searchCtrl = new FormControl();
	conversationTitles: ChatTitle[] = [];
	currentConversationTitle: ChatTitle;
	isCommandMode = false;
	showScrollToLastMessage = false;
	displayTextArea = false;
	scrollVisibilityPending = false;
	activeForm?: {def: FormDef; group: FormGroup};
	attachments: Attachment[] = [];
	isDragOver = false;
	containerResizeObserver: ResizeObserver;
	attachmentsPollingTimedOut = false;
	/**
	 * Mode "LLM seul" choisi pour une conversation qui n'existe pas encore côté backend (avant le premier
	 * échange). Une fois la conversation créée, c'est `currentConversationTitle.type` qui fait foi (cf.
	 * `isLlmOnlyMode()`) : le mode est alors figé pour toute la conversation, comme la navigation privée.
	 */
	ragEnabled = true;

	@ViewChild('userNotRegisteredTriesToChatDialog') userNotRegisteredDialog: TemplateRef<any>;
	@ViewChild('userPendingTriesToChatDialog') userPendingTriesToChatDialog: TemplateRef<any>;
	@ViewChild('johnDoeInfoDialog') johnDoeDialog: TemplateRef<any>;
	@ViewChild('messageContainer') messageContainer: ElementRef;
	@ViewChild('scrollAnchor') scrollAnchor: ElementRef;
	@ViewChildren('messageEl') messageElements!: QueryList<ElementRef>;

	protected readonly ChatMessageSource = ChatMessageSource;

	private readonly destroy$ = new Subject<void>();
	private pollingStop$ = new Subject<void>();
	private pollingCancelled = false;

	get messages(): ChatMessage[] {
		return this.conversationManager.getMessages(this.currentConversationTitle?.conversationId);
	}

	get defaultSuggestions() {
		return this.suggestionService.getDefaultSuggestions();
	}

	get specificSuggestions() {
		return this.suggestionService.getSpecificSuggestions();
	}

	/**
	 * Indique si la conversation courante est en mode "sans Corpus" (LLM seul). Une fois la conversation
	 * persistée côté backend, le type qu'elle a reçu à sa création fait foi ; sinon (nouvelle conversation
	 * pas encore envoyée) on se base sur le choix fait via le bouton "Nouvelle conversation sans Corpus".
	 */
	isLlmOnlyMode(): boolean {
		if (this.currentConversationTitle?.type) {
			return this.currentConversationTitle.type === ConversationType.NO_RAG;
		}
		return !this.ragEnabled;
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
		private readonly authDialogService: UserAuthDialogService
	) {}

	ngAfterViewInit() {
		const el = this.messageContainer?.nativeElement;
		if (!el) return;
		this.containerResizeObserver = new ResizeObserver(() => {
			el.style.setProperty('--container-height', `${el.clientHeight}px`);
		});
		this.containerResizeObserver.observe(el);
	}

	ngOnDestroy() {
		this.pollingCancelled = true;
		this.containerResizeObserver?.disconnect();
		this.destroy$.next();
		this.destroy$.complete();
	}

	ngOnInit() {
		this.speechService.speechStartEvent.subscribe(() => {
			this.messages.forEach(message => {
				message.beingSpoken = false;
			});
		});
		this.authService.$authenticatedUser.subscribe(user => {
			if (user?.status === UserStatus.ACTIVE) {
				this.getConversationTitles();
			}
		});
	}

	isRegistered(): boolean {
		return this.authDialogService.isRegistered();
	}

	getOptionService() {
		return this.autocompleteService.getOptionService(this.isCommandMode, !!this.currentConversationTitle);
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
			this.currentConversationTitle?.conversationId,
			ChatMessageSource.USER,
			question.text,
			false,
			true,
			question.language,
			question.id
		);
		this.conversationManager.addMessage(
			this.currentConversationTitle?.conversationId,
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
		this.scrollToLastUserMessage();
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

	newChat(ragEnabled = true): void {
		if (this.currentConversationTitle) this.currentConversationTitle.selected = false;
		this.currentConversationTitle = null;
		this.ragEnabled = ragEnabled;
		this.attachments = [];
		this.attachmentsPollingTimedOut = false;
		this.stopAttachmentsPolling();
		this.conversationManager.initNewChat();
		this.suggestionService.clearSpecificSuggestions();
		this.resetScrollState();
	}

	canAskLLM() {
		return this.searchCtrl.value && this.attachments.every(att => !att.isUploading);
	}

	sendToLLM(): void {
		// if (!this.isRegistered()) {
		// 	this.showDialog();
		// 	return;
		// }

		this.doSendToLLM();
	}

	doSendToLLM(): void {
		const inputText = this.searchCtrl.value;
		this.prepareForStreaming(inputText);
		this.startStreamingRequest(inputText);
		this.clearSearch();
		this.scrollToLastUserMessage();
	}

	/**
	 * Renvoie une question déjà posée en imposant explicitement le workspace à utiliser
	 * (choisi par l'utilisateur via le badge affiché sous la question). Ajoute une nouvelle
	 * paire question/réponse à la conversation, sans toucher à l'historique existant.
	 */
	onWorkspaceChange(event: {question: string; workspace: string}): void {
		if (!event?.question || !event.workspace) return;
		this.prepareForStreaming(event.question);
		this.startStreamingRequest(event.question, event.workspace);
		this.scrollToLastUserMessage();
	}

	getTargetScrollTop(el: HTMLElement, userEl: HTMLElement): number {
		return el.scrollTop + userEl.getBoundingClientRect().top - el.getBoundingClientRect().top;
	}

	updateScrollButtonVisibility(): void {
		if (this.scrollVisibilityPending) return;
		this.scrollVisibilityPending = true;
		requestAnimationFrame(() => {
			this.scrollVisibilityPending = false;
			const el = this.messageContainer.nativeElement;
			const lastUserEl = this.getLastUserElement();
			if (lastUserEl) {
				this.showScrollToLastMessage = el.scrollTop < this.getTargetScrollTop(el, lastUserEl) - 10;
			}
		});
	}

	scrollToLastUserMessage(): void {
		setTimeout(() => {
			const el = this.messageContainer.nativeElement;
			const lastUserEl = this.getLastUserElement();
			if (!lastUserEl) return this.resetScrollState();
			el.scrollTo({top: this.getTargetScrollTop(el, lastUserEl), behavior: 'smooth'});
			this.showScrollToLastMessage = false;
		});
	}

	getLastUserElement(): HTMLElement | null {
		return (
			[...this.messageElements].reverse().find((_, i, arr) => {
				return this.messages[this.messages.length - 1 - i]?.source === ChatMessageSource.USER;
			})?.nativeElement ?? null
		);
	}

	selectConversation(chatTitle: ChatTitle) {
		this.stopAttachmentsPolling();
		this.attachmentsPollingTimedOut = false;
		this.conversationService.getConversation(chatTitle.conversationId).subscribe(conversation => {
			this.currentConversationTitle = chatTitle;
			// Le type ("COMPLETE"/"NO_RAG") est désormais fourni par le backend avec le titre de la conversation.
			this.ragEnabled = chatTitle.type !== ConversationType.NO_RAG;
			this.updateAttachments(conversation.attachments);
			const chatMessages = conversation.messages.map(msg => this.conversationManager.historyMessageToChatMessage(msg));
			this.conversationManager.setConversationMessages(chatTitle.conversationId, chatMessages);
			this.suggestionService.setSpecificSuggestionsFromMessages(chatMessages);
			this.scrollToLastUserMessage();
			if (this.hasPendingAttachments()) {
				this.startAttachmentsPolling();
			}
		});
	}

	deleteConversation(conversation: ChatTitle) {
		if (conversation.conversationId === this.currentConversationTitle?.conversationId) {
			this.currentConversationTitle = null;
			this.ragEnabled = true;
			this.conversationManager.initNewChat();
			this.suggestionService.clearSpecificSuggestions();
			this.resetScrollState();
		}
		this.conversationManager.deleteConversation(conversation.conversationId);
	}

	getConversationTitles() {
		this.conversationService.getConversationTitles().subscribe(conversations => {
			this.setAndSortConversations(conversations);
		});
	}

	sendFeedback(feedback: Feedback) {
		this.feedbackService.sendAnswerFeedback({conversationId: this.currentConversationTitle.conversationId, ...feedback}).subscribe(() => {
			this.notif.success('feedback.success');
		});
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

	onPaste(event: ClipboardEvent): void {
		const files = Array.from(event.clipboardData?.files ?? []);
		if (files.length > 0) {
			event.preventDefault();
			this.onAttachmentsSelected(files);
		}
	}

	onDragOver(event: DragEvent): void {
		event.preventDefault();
		this.isDragOver = true;
	}

	onDragLeave(event: DragEvent): void {
		event.preventDefault();
		this.isDragOver = false;
	}

	onDrop(event: DragEvent): void {
		event.preventDefault();
		this.isDragOver = false;
		const files = Array.from(event.dataTransfer?.files ?? []);
		if (files.length > 0) {
			this.onAttachmentsSelected(files);
		}
	}

	onAttachmentsSelected(event: File[]) {
		const pendingAttachments: Attachment[] = this.initializePendingAttachments(event);
		this.attachments.push(...pendingAttachments);

		this.conversationService.uploadAttachments(this.currentConversationTitle, ...event).subscribe({
			next: httpEvent => this.handleUploadEvent(httpEvent, pendingAttachments),
			error: () => this.handleUploadError(pendingAttachments)
		});
	}

	removeAttachment(id: number) {
		this.conversationService.deleteAttachment(id).subscribe(() => {
			this.attachments = this.attachments.filter(att => att.id !== id);
			this.notif.success('attachment.delete.success');
		});
	}

	downloadAttachment(attachment: Attachment) {
		if (!attachment.id || attachment.isUploading || !this.currentConversationTitle) {
			return;
		}

		this.conversationService.downloadAttachment(this.currentConversationTitle.conversationId, attachment.id).subscribe({
			next: blob => {
				const url = globalThis.URL.createObjectURL(blob);
				const link = document.createElement('a');
				link.href = url;
				link.download = attachment.fileName || 'attachment';
				link.click();
				globalThis.URL.revokeObjectURL(url);
			},
			error: () => {
				this.notif.error('attachment.download.error');
			}
		});
	}

	retryAttachment(attachment: Attachment): void {
		if (!attachment.file || !this.currentConversationTitle) return;
		attachment.status = 'PENDING';
		attachment.isUploading = true;
		this.cdr.markForCheck();
		this.conversationService.uploadAttachments(this.currentConversationTitle, attachment.file).subscribe({
			next: httpEvent => {
				if (httpEvent.type === HttpEventType.Response) {
					const response = httpEvent.body;
					const serverAtt = response.conversationAttachments.attachments.find(s => s.filename === attachment.file.name);
					if (serverAtt) {
						attachment.id = serverAtt.id;
						attachment.status = serverAtt.status;
						attachment.isUploading = serverAtt.status === 'PENDING';
					}
					this.cdr.markForCheck();
					if (this.hasPendingAttachments()) {
						this.startAttachmentsPolling();
					} else {
						this.notifyPollingComplete(response.status);
					}
				}
			},
			error: () => {
				attachment.status = 'FAILED';
				attachment.isUploading = false;
				this.notif.error('attachment.upload.error');
				this.cdr.markForCheck();
			}
		});
	}

	refreshAttachmentsStatus(): void {
		if (!this.currentConversationTitle) return;
		this.attachmentsPollingTimedOut = false;
		this.startAttachmentsPolling();
	}

	private initializePendingAttachments(files: File[]): Attachment[] {
		return files.map(file => ({
			fileName: file.name,
			fileSize: file.size,
			file,
			status: 'PENDING' as AttachmentStatus,
			isUploading: true
		}));
	}

	private handleUploadEvent(httpEvent: any, pendingAttachments: Attachment[]): void {
		if (httpEvent.type === HttpEventType.Response) {
			this.handleUploadResponse(httpEvent.body as AttachmentUploadResponse, pendingAttachments);
		}
	}

	private handleUploadResponse(response: AttachmentUploadResponse, pendingAttachments: Attachment[]): void {
		if (!this.currentConversationTitle) {
			this.createConversationFromUpload(response);
		}
		this.syncAttachmentsFromResponse(response, pendingAttachments);
		this.cdr.markForCheck();
		if (this.hasPendingAttachments()) {
			this.startAttachmentsPolling();
		} else {
			this.notifyPollingComplete(response.status);
		}
	}

	private createConversationFromUpload(response: AttachmentUploadResponse): void {
		this.currentConversationTitle = {
			conversationId: response.conversationAttachments.conversationId,
			title: 'Processing attachments...',
			timestamp: new Date(),
			selected: true,
			type: this.ragEnabled ? ConversationType.COMPLETE : ConversationType.NO_RAG
		};
	}

	private syncAttachmentsFromResponse(response: AttachmentUploadResponse, pendingAttachments: Attachment[]): void {
		response.conversationAttachments.attachments.forEach(serverAtt => {
			const localAtt = pendingAttachments.find(att => att.file?.name === serverAtt.filename);
			if (localAtt) {
				localAtt.id = serverAtt.id;
				localAtt.status = serverAtt.status;
				localAtt.isUploading = serverAtt.status === 'PENDING';
			}
		});
	}

	private updateAttachments(conversationAttachments: AttachmentDTO[]): void {
		this.attachments = conversationAttachments.map(convAtt => ({
			id: convAtt.id,
			fileName: convAtt.filename,
			fileSize: convAtt.fileSize,
			status: convAtt.status,
			isUploading: convAtt.status === 'PENDING'
		}));
	}

	private handleUploadError(pendingAttachments: Attachment[]): void {
		this.attachments = this.attachments.filter(att => !pendingAttachments.includes(att));
		this.notif.error('attachment.upload.error');
	}

	private hasPendingAttachments(): boolean {
		return this.attachments.some(att => att.status === 'PENDING');
	}

	private startAttachmentsPolling(): void {
		if (!this.currentConversationTitle) return;
		this.stopAttachmentsPolling();
		this.pollingCancelled = false;
		this.attachmentsPollingTimedOut = false;

		timer(0, ATTACHMENT_POLL_INTERVAL_MS)
			.pipe(
				takeUntil(merge(this.destroy$, this.pollingStop$)),
				take(ATTACHMENT_POLL_MAX_ATTEMPTS),
				takeWhile(() => this.hasPendingAttachments()),
				switchMap(() => this.conversationService.getConversationAttachmentsStatus(this.currentConversationTitle.conversationId))
			)
			.subscribe({
				next: (response: AttachmentUploadResponse) => {
					this.updateAttachmentsFromPoll(response);
					this.cdr.markForCheck();
					if (!this.hasPendingAttachments()) {
						this.notifyPollingComplete(response.status);
						this.stopAttachmentsPolling();
					}
				},
				complete: () => {
					if (!this.pollingCancelled && this.hasPendingAttachments()) {
						this.attachmentsPollingTimedOut = true;
						this.notif.warning('attachment.process.timeout');
						this.cdr.markForCheck();
					}
				}
			});
	}

	private stopAttachmentsPolling(): void {
		this.pollingCancelled = true;
		this.pollingStop$.next();
		this.pollingStop$ = new Subject<void>();
	}

	private updateAttachmentsFromPoll(response: AttachmentUploadResponse): void {
		response.conversationAttachments.attachments.forEach(serverAtt => {
			const localAtt = this.attachments.find(att => att.id === serverAtt.id);
			if (localAtt) {
				localAtt.status = serverAtt.status;
				localAtt.isUploading = serverAtt.status === 'PENDING';
			}
		});
	}

	private notifyPollingComplete(aggregatedStatus: AttachmentStatus): void {
		if (aggregatedStatus === 'PROCESSED') {
			this.notif.success('attachment.process.success');
		} else if (aggregatedStatus === 'FAILED') {
			this.notif.error('attachment.process.error');
		}
	}

	private resetScrollState(): void {
		const el = this.messageContainer?.nativeElement;
		if (!el) return;
		el.scrollTop = 0;
		this.showScrollToLastMessage = false;
	}

	private prepareForStreaming(inputText: string): void {
		this.conversationManager.setActiveStreamingConversation(this.currentConversationTitle?.conversationId);
		this.conversationManager.addMessage(this.currentConversationTitle?.conversationId, ChatMessageSource.USER, inputText);
		this.conversationManager.addMessage(this.currentConversationTitle?.conversationId, ChatMessageSource.LLM, '', false, false);
		this.disableSearch();
		this.suggestionService.clearSpecificSuggestions();
	}

	private startStreamingRequest(inputText: string, workspace?: string): void {
		const currentLang = this.translateService.currentLang;
		const mappedLanguage = LANGUAGE_MAP[currentLang] || Language.DE;

		const requestConfig = {
			query: inputText,
			conversationId: this.currentConversationTitle?.conversationId,
			language: mappedLanguage,
			workspace,
			ragEnabled: !this.isLlmOnlyMode()
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

	private processStreamChunk(chunk: string): void {
		const streamingMessages = this.conversationManager.getStreamingMessages();
		if (!streamingMessages || streamingMessages.length === 0) return;

		const partialChatMessage = streamingMessages.at(-1);
		if (!partialChatMessage) return;

		const result = this.streamProcessor.processChunk(chunk, partialChatMessage);

		// The workspace used to answer is surfaced on the question rather than the answer bubble.
		if (partialChatMessage.workspace) {
			const questionMessage = streamingMessages.at(-2);
			if (questionMessage && questionMessage.source === ChatMessageSource.USER) {
				questionMessage.workspace = partialChatMessage.workspace;
			}
		}

		if (result.hasNewSuggestion && result.newSuggestion) {
			this.suggestionService.addSpecificSuggestion(result.newSuggestion);
		}

		if (result.shouldEnableSearch) {
			this.enableSearch();
		}

		if (result.shouldRefreshConversations && (!this.currentConversationTitle || this.currentConversationTitle.title === 'Processing attachments...')) {
			this.refreshConversations();
		}

		this.updateScrollButtonVisibility();
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
		if (this.currentConversationTitle) {
			this.conversationService.update(this.currentConversationTitle.conversationId, [this.messages.at(-2), this.messages.at(-1)]);
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
				this.currentConversationTitle = this.conversationTitles[0];
				this.currentConversationTitle.selected = true;
				// Le type de conversation fait désormais foi une fois renvoyé par le backend.
				if (this.currentConversationTitle.type) {
					this.ragEnabled = this.currentConversationTitle.type !== ConversationType.NO_RAG;
				}
				// Transfer messages from NEW_CHAT_KEY to the new conversation
				this.conversationManager.transferNewChatToConversation(this.currentConversationTitle.conversationId);
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
