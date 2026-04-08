import { ChangeDetectorRef, Component, ElementRef, HostListener, OnInit, QueryList, TemplateRef, ViewChild, ViewChildren } from "@angular/core";
import {FormControl, FormGroup} from '@angular/forms';
import {IQuestion, Language} from '../shared/model/answer';
import {RagService} from '../shared/services/rag.service';
import {clearNullAndEmpty} from '../shared/utils/zco-utils';
import {ChatMessage, ChatMessageSource} from '../shared/model/chat-message';
import {SpeechService} from '../shared/services/speech.service';
import {Attachment, AttachmentDTO, ChatTitle} from '../shared/model/chat-history';
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
import {MatDialog} from '@angular/material/dialog';
import {
	AutocompleteType,
	ChatAutocompleteService,
	ChatConversationManagerService,
	ChatStreamProcessorService,
	ChatSuggestionService,
	LANGUAGE_MAP,
	UserAuthDialogService
} from './services';
import {filter, map, of} from 'rxjs';

@Component({
	selector: 'zco-chat',
	templateUrl: './chat.component.html',
	styleUrls: ['./chat.component.scss']
})
export class ChatComponent implements OnInit {
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
	availableWorkspaces: string[] = [];
	selectedWorkspace = '';

	@ViewChild('userNotRegisteredTriesToChatDialog') userNotRegisteredDialog: TemplateRef<any>;
	@ViewChild('userPendingTriesToChatDialog') userPendingTriesToChatDialog: TemplateRef<any>;
	@ViewChild('johnDoeInfoDialog') johnDoeDialog: TemplateRef<any>;
	@ViewChild('workspaceSelectionDialog') workspaceSelectionDialog: TemplateRef<any>;
	@ViewChild('messageContainer') messageContainer: ElementRef;
	@ViewChildren('messageEl') messageElements!: QueryList<ElementRef>;

	protected readonly ChatMessageSource = ChatMessageSource;

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
		private readonly authDialogService: UserAuthDialogService,
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
		this.conversationService.getAvailableWorkspaces().subscribe(workspaces => {
			this.availableWorkspaces = workspaces;
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

	newChat(): void {
		if (this.currentConversationTitle) this.currentConversationTitle.selected = false;
		this.currentConversationTitle = null;
		this.conversationManager.initNewChat();
		this.suggestionService.clearSpecificSuggestions();
		this.resetScrollState();
		this.openWorkspaceSelectionDialog();
	}

	openWorkspaceSelectionDialog(): void {
		if (!this.workspaceSelectionDialog || !this.availableWorkspaces?.length) return;
		this.dialog.open(this.workspaceSelectionDialog, {width: '400px', disableClose: false});
	}

	selectWorkspaceAndClose(workspace: string): void {
		this.selectedWorkspace = workspace;
		this.dialog.closeAll();
	}

	canAskLLM() {
		return this.searchCtrl.value && this.attachments.every(att => !att.isUploading);
	}

	sendToLLM(): void {
		if (!this.isRegistered()) {
			this.showDialog();
			return;
		}

		const openWorkspaceDialog$ = this.selectedWorkspace
			? of(true)
			: this.dialog
					.open(this.workspaceSelectionDialog, {width: '400px', disableClose: false})
					.afterClosed()
					.pipe(map(() => !!this.selectedWorkspace));

		openWorkspaceDialog$.pipe(filter(Boolean)).subscribe(() => this.doSendToLLM());
	}

	doSendToLLM(): void {
		const inputText = this.searchCtrl.value;
		this.prepareForStreaming(inputText);
		this.startStreamingRequest(inputText);
		this.clearSearch();
		this.scrollToLastUserMessage();
	}

	updateScrollButtonVisibility(): void {
		if (this.scrollVisibilityPending) return;
		this.scrollVisibilityPending = true;
		requestAnimationFrame(() => {
			this.scrollVisibilityPending = false;
			const el = this.messageContainer?.nativeElement;
			if (!el) return;
			const target = this.getTargetScrollTop(el);
			if (target !== null && el.scrollTop > target) {
				el.scrollTop = target;
			}
			this.showScrollToLastMessage = target !== null && el.scrollTop < target - 10;
		});
	}

	getTargetScrollTop(el: HTMLElement): number | null {
		const WHITE_ZONE = 80;
		const allMessages = Array.from(el.querySelectorAll<HTMLElement>('.message'));
		const lastUserMsg = [...allMessages].reverse().find(m => m.classList.contains('user')) ?? null;

		if (!lastUserMsg) return null;
		const llmMsg = allMessages[allMessages.indexOf(lastUserMsg) + 1] ?? null;
		if (!llmMsg) return lastUserMsg.offsetTop;

		const llmMsgBottom = llmMsg.offsetTop + llmMsg.offsetHeight;
		const blockFitsInView = llmMsgBottom - lastUserMsg.offsetTop <= el.clientHeight;
		return blockFitsInView ? lastUserMsg.offsetTop : llmMsgBottom - el.clientHeight + WHITE_ZONE;
	}

	scrollToLastUserMessage(): void {
		setTimeout(() => {
			const el = this.messageContainer?.nativeElement;
			if (!el) return;
			el.style.paddingBottom = `${el.clientHeight}px`;
			const target = this.getTargetScrollTop(el);
			if (target === null) {
				this.resetScrollState();
				return;
			}
			el.scrollTo({top: target, behavior: 'smooth'});
			this.showScrollToLastMessage = false;
		});
	}

	getLastUserElement(): HTMLElement | null {
		const elements = this.messageElements.toArray();

		for (let i = elements.length - 1; i >= 0; i--) {
			if (this.messages[i].source === ChatMessageSource.USER) {
				return elements[i].nativeElement;
			}
		}
		return null;
	}

	selectConversation(chatTitle: ChatTitle) {
		this.conversationService.getConversation(chatTitle.conversationId).subscribe(conversation => {
			this.currentConversationTitle = chatTitle;
			this.updateAttachments(conversation.attachments);
			const chatMessages = conversation.messages.map(msg => this.conversationManager.historyMessageToChatMessage(msg));
			this.conversationManager.setConversationMessages(chatTitle.conversationId, chatMessages);
			this.selectedWorkspace = chatTitle.workspace;
			this.suggestionService.setSpecificSuggestionsFromMessages(chatMessages);
			this.scrollToLastUserMessage();
		});
	}

	deleteConversation(conversation: ChatTitle) {
		if (conversation.conversationId === this.currentConversationTitle?.conversationId) {
			this.currentConversationTitle = null;
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

	private initializePendingAttachments(files: File[]): Attachment[] {
		return files.map(file => ({
			fileName: file.name,
			fileSize: file.size,
			file,
			isUploading: true
		}));
	}

	private handleUploadEvent(httpEvent: any, pendingAttachments: Attachment[]): void {
		if (httpEvent.type === HttpEventType.Response) {
			this.handleUploadResponse(httpEvent.body, pendingAttachments);
		}
	}

	private handleUploadResponse(response: any, pendingAttachments: Attachment[]): void {
		if (response.success) {
			this.handleSuccessfulUpload(response, pendingAttachments);
		} else {
			this.handleFailedUpload(response, pendingAttachments);
		}
	}

	private handleSuccessfulUpload(response: any, pendingAttachments: Attachment[]): void {
		if (!this.currentConversationTitle) {
			this.createConversationFromUpload(response);
		}
		this.updateAttachmentsWithServerIds(response, pendingAttachments);
		this.notif.success(response.message);
		this.cdr.markForCheck();
	}

	private createConversationFromUpload(response: any): void {
		this.currentConversationTitle = {
			conversationId: response.conversationAttachments.conversationId,
			title: 'Processing attachments...',
			timestamp: new Date(),
			selected: true
		};
	}

	private updateAttachmentsWithServerIds(response: any, pendingAttachments: Attachment[]): void {
		response.conversationAttachments.attachments.forEach((serverAtt: {id: number; filename: string}) => {
			const localAtt = pendingAttachments.find(att => att.file.name === serverAtt.filename);
			if (localAtt) {
				localAtt.id = serverAtt.id;
				localAtt.isUploading = false;
			}
		});
	}

	private updateAttachments(conversationAttachments: AttachmentDTO[]): void {
		this.attachments = [];
		for (const convAtt of conversationAttachments) {
			this.attachments.push({
				id: convAtt.id,
				fileName: convAtt.filename,
				fileSize: convAtt.fileSize,
				isUploading: false
			});
		}
	}

	private handleFailedUpload(response: any, pendingAttachments: Attachment[]): void {
		this.attachments = this.attachments.filter(att => !pendingAttachments.includes(att));
		this.notif.error(response.message);
	}

	private handleUploadError(pendingAttachments: Attachment[]): void {
		this.attachments = this.attachments.filter(att => !pendingAttachments.includes(att));
		this.notif.error('attachment.upload.error');
	}

	private resetScrollState(): void {
		const el = this.messageContainer?.nativeElement;
		if (!el) return;
		el.style.paddingBottom = '';
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

	private startStreamingRequest(inputText: string): void {
		const currentLang = this.translateService.currentLang;
		const mappedLanguage = LANGUAGE_MAP[currentLang] || Language.DE;

		const requestConfig = {
			query: inputText,
			conversationId: this.currentConversationTitle?.conversationId,
			workspace: this.selectedWorkspace || undefined,
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
