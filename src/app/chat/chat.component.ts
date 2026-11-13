import {AfterViewInit, ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, QueryList, TemplateRef, ViewChild, ViewChildren} from '@angular/core';
import {FormControl, FormGroup} from '@angular/forms';
import {IQuestion, Language} from '../shared/model/answer';
import {RagService} from '../shared/services/rag.service';
import {StreamHttpError} from '../shared/services/sse-client.service';
import {FrameBatcher} from '../shared/utils/frame-batcher';
import {ChatRequest} from '../shared/model/rag';
import {ChatStreamEvent} from '../shared/model/chat-stream-event';
import {clearNullAndEmpty} from '../shared/utils/zco-utils';
import {ChatMessage, ChatMessageSource} from '../shared/model/chat-message';
import {SpeechService} from '../shared/services/speech.service';
import {Attachment, AttachmentDTO, AttachmentStatus, AttachmentUploadResponse, ChatTitle, ConversationType} from '../shared/model/chat-history';
import {extractUploadErrorCode, isRetryableUploadError, uploadErrorKey, uploadErrorNotification} from '../shared/utils/upload-error.utils';
import {ConversationService} from '../shared/services/conversation.service';
import {TranslateService} from '@ngx-translate/core';
import {Feedback} from '../shared/model/feedback';
import {FeedbackService} from '../shared/services/feedback.service';
import {ObNotificationService} from '@oblique/oblique';
import {UserStatus} from '../shared/model/user';
import {AuthenticationServiceV2} from '../shared/services/auth.service';
import {FormDef} from '../shared/model/form-definition';
import {DynamicFormService} from '../shared/services/dynamic-form.service';
import {HttpEvent, HttpEventType} from '@angular/common/http';
import {
	AutocompleteType,
	ChatAutocompleteService,
	ChatConversationManagerService,
	ChatStreamProcessorService,
	ChatSuggestionService,
	LANGUAGE_MAP,
	UserAuthDialogService
} from './services';
import {Subject, Subscription, merge, switchMap, take, takeUntil, takeWhile, timer} from 'rxjs';
import {v4 as uuidv4} from 'uuid';

const ATTACHMENT_POLL_INTERVAL_MS = 15_000;
const ATTACHMENT_POLL_MAX_ATTEMPTS = 240;

interface ActiveStream {
	subscription: Subscription;
	batcher: FrameBatcher<ChatStreamEvent>;
}

interface StreamingOptions {
	/** Workspace imposé par l'utilisateur (sinon routing automatique). */
	workspace?: string;
	replaceLastTurn?: boolean;
}

interface StreamingTarget {
	question: ChatMessage;
	answer: ChatMessage;
}

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
	/** Flux en cours, par paire question/réponse (plusieurs peuvent coexister, cf. startStreamingRequest). */
	private readonly activeStreams = new Map<StreamingTarget, ActiveStream>();
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
		this.cancelPendingGenerations();
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
		this.cancelPendingGenerations();
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
		const target = this.prepareForStreaming(inputText);
		this.startStreamingRequest(target, inputText);
		this.clearSearch();
		this.scrollToLastUserMessage();
	}

	/** Une réponse est en cours de génération (avant `done` ou `error`). */
	get isGenerating(): boolean {
		return [...this.activeStreams.keys()].some(target => !target.answer.isCompleted);
	}

	/** Dernier échange question/réponse, s'il peut être régénéré ou modifié. */
	get replayableTurn(): StreamingTarget | null {
		const question = this.messages.at(-2);
		const answer = this.messages.at(-1);
		const isTurn = question?.source === ChatMessageSource.USER && answer?.source === ChatMessageSource.LLM;
		return isTurn && answer.isCompleted && !this.isGenerating ? {question, answer} : null;
	}

	isReplayable(message: ChatMessage): boolean {
		const turn = this.replayableTurn;
		return !!turn && (message === turn.question || message === turn.answer);
	}

	stopGeneration(): void {
		this.cancelPendingGenerations();
		this.cdr.markForCheck();
	}

	regenerateLastAnswer(): void {
		const turn = this.replayableTurn;
		if (turn) this.replayTurn(turn);
	}

	editLastQuestion(text: string): void {
		const turn = this.replayableTurn;
		if (!turn || !text?.trim()) return;
		turn.question.message = text.trim();
		this.replayTurn(turn);
	}

	/**
	 * Renvoie une question déjà posée en imposant explicitement le workspace à utiliser
	 * (choisi par l'utilisateur via le badge affiché sous la question). Ajoute une nouvelle
	 * paire question/réponse à la conversation, sans toucher à l'historique existant.
	 */
	onWorkspaceChange(event: {question: string; workspace: string}): void {
		if (!event?.question || !event.workspace) return;
		const target = this.prepareForStreaming(event.question);
		this.startStreamingRequest(target, event.question, {workspace: event.workspace});
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
		this.cancelPendingGenerations();
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
			error: err => this.handleUploadError(pendingAttachments, err)
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

	canRetryAttachment(attachment: Attachment): boolean {
		return attachment.status === 'FAILED' && !!attachment.file && isRetryableUploadError(attachment.errorCode);
	}

	getAttachmentFailureKey(attachment: Attachment): string {
		return attachment.errorCode ? uploadErrorKey(attachment.errorCode) : 'attachment.failed';
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
						attachment.errorCode = serverAtt.errorCode;
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
			error: err => {
				attachment.status = 'FAILED';
				attachment.errorCode = extractUploadErrorCode(err);
				attachment.isUploading = false;
				this.notif.error(uploadErrorNotification(err, 'attachment.upload.error', attachment.fileName));
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

	private handleUploadEvent(httpEvent: HttpEvent<AttachmentUploadResponse>, pendingAttachments: Attachment[]): void {
		if (httpEvent.type === HttpEventType.Response) {
			this.handleUploadResponse(httpEvent.body, pendingAttachments);
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
		this.ensureCurrentConversation('Processing attachments...', response.conversationAttachments.conversationId);
	}

	/**
	 * Crée localement la conversation courante si elle n'existe pas encore : le front est propriétaire
	 * de son identifiant (ou réutilise celui fourni par le backend), ce qui permet de rattacher les
	 * questions suivantes sans attendre la génération du titre côté backend.
	 */
	private ensureCurrentConversation(title: string, conversationId?: string): void {
		if (this.currentConversationTitle) return;
		this.currentConversationTitle = {
			conversationId: conversationId ?? uuidv4(),
			title,
			timestamp: new Date(),
			selected: true,
			type: this.ragEnabled ? ConversationType.COMPLETE : ConversationType.NO_RAG,
			provisional: true
		};
		this.conversationManager.transferNewChatToConversation(this.currentConversationTitle.conversationId);
	}

	/** Affiche immédiatement une conversation provisoire dans la liste, avec la question comme titre temporaire. */
	private listProvisionalConversation(question: string): void {
		const current = this.currentConversationTitle;
		if (!current?.provisional || this.conversationTitles.includes(current)) return;
		current.title = question;
		this.conversationTitles = [current, ...this.conversationTitles];
	}

	private syncAttachmentsFromResponse(response: AttachmentUploadResponse, pendingAttachments: Attachment[]): void {
		response.conversationAttachments.attachments.forEach(serverAtt => {
			const localAtt = pendingAttachments.find(att => att.file?.name === serverAtt.filename);
			if (localAtt) {
				localAtt.id = serverAtt.id;
				localAtt.status = serverAtt.status;
				localAtt.errorCode = serverAtt.errorCode;
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
			errorCode: convAtt.errorCode,
			isUploading: convAtt.status === 'PENDING'
		}));
	}

	private handleUploadError(pendingAttachments: Attachment[], error: unknown): void {
		this.attachments = this.attachments.filter(att => !pendingAttachments.includes(att));
		this.notif.error(uploadErrorNotification(error, 'attachment.upload.error'));
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
				localAtt.errorCode = serverAtt.errorCode;
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

	private prepareForStreaming(inputText: string): StreamingTarget {
		this.ensureCurrentConversation(inputText);
		this.listProvisionalConversation(inputText);
		const conversationId = this.currentConversationTitle?.conversationId;
		const question = this.conversationManager.addMessage(conversationId, ChatMessageSource.USER, inputText);
		const answer = this.conversationManager.addMessage(conversationId, ChatMessageSource.LLM, '', false, false);
		this.disableSearch();
		this.suggestionService.clearSpecificSuggestions();
		return {question, answer};
	}

	/**
	 * Chaque requête alimente sa propre paire question/réponse (`target`) : une requête qui se termine
	 * (ex. pendant la génération du titre côté backend) n'interfère pas avec une question de suivi en cours.
	 */
	private startStreamingRequest(target: StreamingTarget, inputText: string, options: StreamingOptions = {}): void {
		const requestConfig = this.buildChatRequest(inputText, options);

		// Les événements sont appliqués un par un, mais un seul rendu est déclenché par frame.
		const batcher = new FrameBatcher<ChatStreamEvent>(events => {
			events.forEach(event => this.processStreamEvent(event, target));
			this.cdr.markForCheck();
		});
		const subscription = this.ragService.process(clearNullAndEmpty(requestConfig)).subscribe({
			next: event => batcher.push(event),
			error: err => {
				batcher.flush();
				this.activeStreams.delete(target);
				this.handleStreamError(err, target);
				this.cdr.markForCheck();
			},
			complete: () => {
				batcher.flush();
				this.onStreamComplete(target, requestConfig.conversationId);
			}
		});
		if (!subscription.closed) {
			this.activeStreams.set(target, {subscription, batcher});
		}
	}

	private buildChatRequest(inputText: string, {workspace, replaceLastTurn}: StreamingOptions): ChatRequest {
		const currentLang = this.translateService.currentLang;
		return {
			query: inputText,
			conversationId: this.currentConversationTitle?.conversationId,
			language: LANGUAGE_MAP[currentLang] || Language.DE,
			workspace,
			ragEnabled: !this.isLlmOnlyMode(),
			// N'est envoyé que s'il est vrai, pour rester compatible avec un backend qui ne le connaît pas.
			replaceLastTurn: replaceLastTurn || undefined
		};
	}

	private onStreamComplete(target: StreamingTarget, conversationId: string | undefined): void {
		this.activeStreams.delete(target);
		this.completeUnfinishedAnswer(target);
		// Le stream ne se termine qu'après la persistance de l'échange et la génération du titre.
		const conversation = this.conversationTitles.find(c => c.conversationId === conversationId);
		if (conversation?.provisional) {
			this.refreshConversations();
		}
		this.cdr.markForCheck();
	}

	/**
	 * Annule les générations dont la réponse n'est pas encore terminée (pas de `done`).
	 * Les flux déjà terminés côté réponse continuent : le backend y génère le titre.
	 */
	private cancelPendingGenerations(): void {
		this.activeStreams.forEach(({subscription, batcher}, target) => {
			batcher.flush();
			if (target.answer.isCompleted) return;
			subscription.unsubscribe();
			this.activeStreams.delete(target);
			this.streamProcessor.interrupt(target.answer);
		});
		this.enableSearch();
	}

	/**
	 * Rejoue le dernier échange en le remplaçant (côté backend si l'échange a été enregistré).
	 * La réponse est remplacée par un nouvel objet : un flux précédent encore ouvert (génération du titre)
	 * ne peut ainsi pas modifier la nouvelle réponse.
	 */
	private replayTurn(turn: StreamingTarget): void {
		const replaceLastTurn = !!(turn.answer.hasSavedExchange || turn.answer.id);
		const messages = this.messages;
		const answer: ChatMessage = {
			message: '',
			source: ChatMessageSource.LLM,
			timestamp: new Date(),
			isCompleted: false,
			beingSpoken: false,
			sources: [],
			hasSavedExchange: replaceLastTurn
		};
		messages[messages.indexOf(turn.answer)] = answer;
		turn.question.workspace = undefined;
		this.disableSearch();
		this.suggestionService.clearSpecificSuggestions();
		this.startStreamingRequest({question: turn.question, answer}, turn.question.message, {replaceLastTurn});
		this.scrollToLastUserMessage();
	}

	/**
	 * Flux fermé sans `done` ni `error` (coupure réseau, proxy) : rien ne garantit que l'échange a été enregistré.
	 * La réponse partielle est conservée comme interrompue, sinon la réponse passe en erreur.
	 */
	private completeUnfinishedAnswer(target: StreamingTarget): void {
		if (target.answer.isCompleted) return;
		if (target.answer.message && !target.answer.status) {
			this.streamProcessor.interrupt(target.answer);
		} else {
			this.markAnswerInError(target, 'chat.stream.error.incomplete');
		}
		this.enableSearch();
	}

	private processStreamEvent(event: ChatStreamEvent, target: StreamingTarget): void {
		const result = this.streamProcessor.processEvent(event, target.answer);

		// The workspace used to answer is surfaced on the question rather than the answer bubble.
		if (target.answer.workspace) {
			target.question.workspace = target.answer.workspace;
		}

		result.newSuggestions.forEach(suggestion => this.suggestionService.addSpecificSuggestion(suggestion));

		if (result.completed) {
			this.enableSearch();
		} else if (result.failed) {
			this.markAnswerInError(target, 'chat.stream.error');
			this.enableSearch();
		}

		this.updateScrollButtonVisibility();
	}

	private handleStreamError(err: unknown, target: StreamingTarget): void {
		if (err instanceof StreamHttpError && err.status === 401) {
			this.markAnswerInError(target, 'chat.stream.error.session');
		} else if (!target.answer.isCompleted) {
			this.markAnswerInError(target, 'chat.stream.error');
		}
		this.enableSearch();
	}

	private markAnswerInError(target: StreamingTarget, messageKey: string): void {
		Object.assign(target.answer, {
			message: this.translateService.instant(messageKey),
			source: ChatMessageSource.LLM,
			timestamp: new Date(),
			isCompleted: true,
			inError: true,
			beingSpoken: false,
			sources: []
		});
	}

	private updateCurrentConversation() {
		if (!this.isRegistered()) return;
		if (this.currentConversationTitle) {
			this.conversationService.update(this.currentConversationTitle.conversationId, [this.messages.at(-2), this.messages.at(-1)]);
		} else {
			this.conversationService.init(this.messages).subscribe(() => {
				this.refreshConversations(true);
			});
		}
	}

	/**
	 * Recharge les titres depuis le backend et resynchronise la conversation courante par son identifiant
	 * (titre provisoire remplacé par le titre généré). `selectNewest` est réservé au flux FAQ, où le backend
	 * génère l'id sans le renvoyer : la conversation la plus récente devient alors la conversation courante.
	 */
	private refreshConversations(selectNewest = false) {
		this.conversationService.getConversationTitles().subscribe(conversations => {
			const serverIds = new Set(conversations.map(c => c.conversationId));
			// Les conversations provisoires pas encore connues du backend (titre en cours de génération) sont conservées.
			const pending = this.conversationTitles.filter(c => c.provisional && !serverIds.has(c.conversationId));
			this.setAndSortConversations([...pending, ...conversations]);
			const newest = this.conversationTitles.find(c => serverIds.has(c.conversationId));

			if (selectNewest && !this.currentConversationTitle && newest) {
				this.currentConversationTitle = newest;
				this.conversationManager.transferNewChatToConversation(newest.conversationId);
			}

			const current = this.conversationTitles.find(c => c.conversationId === this.currentConversationTitle?.conversationId);
			if (!current) return;
			current.selected = true;
			this.currentConversationTitle = current;
			// Le type de conversation fait désormais foi une fois renvoyé par le backend.
			if (current.type) {
				this.ragEnabled = current.type !== ConversationType.NO_RAG;
			}
		});
	}

	private setAndSortConversations(conversations: ChatTitle[]) {
		conversations.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
		this.conversationTitles = conversations;
	}

	private showDialog() {
		this.authDialogService.showAuthDialog(this.userNotRegisteredDialog, this.johnDoeDialog, this.userPendingTriesToChatDialog);
	}
}
