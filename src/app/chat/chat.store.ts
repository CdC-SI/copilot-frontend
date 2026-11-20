import {Injectable, computed, effect, inject, signal} from '@angular/core';
import {takeUntilDestroyed, toSignal} from '@angular/core/rxjs-interop';
import {FormControl, FormGroup} from '@angular/forms';
import {TranslateService} from '@ngx-translate/core';
import {ObNotificationService} from '@oblique/oblique';
import {Subject} from 'rxjs';
import {v4 as uuidv4} from 'uuid';
import {IQuestion, Language} from '../shared/model/answer';
import {Attachment, ChatTitle} from '../shared/model/chat-history';
import {ChatMessage, ChatMessageSource} from '../shared/model/chat-message';
import {Feedback} from '../shared/model/feedback';
import {FormDef} from '../shared/model/form-definition';
import {ToolApprovalRequest} from '../shared/model/tool-step';
import {UserStatus} from '../shared/model/user';
import {AuthenticationServiceV2} from '../shared/services/auth.service';
import {ConversationService} from '../shared/services/conversation.service';
import {DynamicFormService} from '../shared/services/dynamic-form.service';
import {FeedbackService} from '../shared/services/feedback.service';
import {ChatAttachmentsStore} from './chat-attachments.store';
import {ChatConversationsStore} from './chat-conversations.store';
import {ChatGenerationStore, StreamingTarget} from './chat-generation.store';
import {ChatScrollRequest, ChatTurn, StreamOptions} from './chat.models';
import {AutocompleteType, ChatAutocompleteService, ChatConversationManagerService, ChatSuggestionService, LANGUAGE_MAP} from './services';

/**
 * État du chat (signals) et orchestration : saisie, envoi, régénération, Stop, conversations, pièces jointes.
 * Fourni par `ChatComponent` : l'état est réinitialisé à chaque ouverture de la page et les générations en cours
 * sont annulées à sa destruction ; seul le cache des messages (`ChatConversationManagerService`) est conservé.
 */
@Injectable()
export class ChatStore {
	readonly searchCtrl = new FormControl();
	readonly conversationTitles = computed(() => this.conversations.titles());
	readonly currentConversation = computed(() => this.conversations.current());
	readonly messages = computed(() => this.manager.messages(this.currentConversation()?.conversationId ?? null)());
	readonly isRegistered = computed(() => this.user()?.status === UserStatus.ACTIVE);
	readonly commandMode = computed(() => this.isCommandMode());
	readonly activeForm = computed(() => this.form());
	readonly suggestions = computed(() => this.suggestionService.suggestions());
	readonly optionService = computed(() => this.autocompleteService.getOptionService(this.isCommandMode(), !!this.currentConversation()));
	readonly isGenerating = computed(() => this.generation.isGenerating());
	readonly isStopping = computed(() => this.generation.isStopping());
	readonly attachments = computed(() => this.attachmentsStore.attachments());
	readonly attachmentsPollingTimedOut = computed(() => this.attachmentsStore.pollingTimedOut());
	readonly canSend = computed(() => !!this.searchValue() && !this.attachmentsStore.isUploading());
	/** Dernier échange question/réponse, s'il peut être régénéré ou modifié. */
	readonly replayableTurn = computed<ChatTurn | null>(() => {
		const [question, answer] = this.messages().slice(-2);
		const isTurn = question?.source === ChatMessageSource.USER && answer?.source === ChatMessageSource.LLM;
		return isTurn && answer.isCompleted && !this.isGenerating() ? {question, answer} : null;
	});
	readonly scrollRequests = new Subject<ChatScrollRequest>();
	private readonly isCommandMode = signal(false);
	private readonly form = signal<{def: FormDef; group: FormGroup} | undefined>(undefined);
	private readonly searchValue = toSignal(this.searchCtrl.valueChanges, {initialValue: this.searchCtrl.value});
	private readonly authService = inject(AuthenticationServiceV2);
	private readonly user = toSignal(this.authService.$authenticatedUser);
	private readonly conversations = inject(ChatConversationsStore);
	private readonly generation = inject(ChatGenerationStore);
	private readonly attachmentsStore = inject(ChatAttachmentsStore);
	private readonly manager = inject(ChatConversationManagerService);
	private readonly suggestionService = inject(ChatSuggestionService);
	private readonly autocompleteService = inject(ChatAutocompleteService);
	private readonly conversationService = inject(ConversationService);
	private readonly feedbackService = inject(FeedbackService);
	private readonly dfs = inject(DynamicFormService);
	private readonly translateService = inject(TranslateService);
	private readonly notif = inject(ObNotificationService);

	constructor() {
		// La saisie est bloquée pendant la génération d'une réponse.
		effect(() => (this.isGenerating() ? this.searchCtrl.disable() : this.searchCtrl.enable()));
		this.authService.$authenticatedUser.pipe(takeUntilDestroyed()).subscribe(user => {
			if (user?.status === UserStatus.ACTIVE) this.conversations.loadTitles();
		});
	}

	setCommandMode(input: string | undefined): void {
		this.isCommandMode.set(!!input?.startsWith('/'));
	}

	optionLabel(option: AutocompleteType): string {
		return this.autocompleteService.getOptionLabel(option, this.isCommandMode());
	}

	selectOption(value: AutocompleteType): void {
		if (this.autocompleteService.isCommand(value)) {
			this.searchCtrl.setValue(value.name);
		} else {
			this.selectFaqOption(value);
		}
	}

	clearSearch(): void {
		this.searchCtrl.setValue('');
	}

	send(): void {
		this.ask(this.searchCtrl.value);
		this.clearSearch();
	}

	newChat(): void {
		this.generation.cancelPending();
		this.conversations.startNew();
		this.attachmentsStore.reset();
		this.manager.initNewChat();
		this.suggestionService.clearSpecificSuggestions();
		this.scrollRequests.next('reset');
	}

	selectConversation(chatTitle: ChatTitle): void {
		this.conversations.markSelected(chatTitle.conversationId);
		this.generation.cancelPending();
		this.attachmentsStore.suspend();
		this.conversationService.getConversation(chatTitle.conversationId).subscribe(conversation => {
			this.conversations.open(chatTitle);
			const messages = conversation.messages.map(message => this.manager.historyMessageToChatMessage(message));
			this.attachmentsStore.load(chatTitle.conversationId, conversation.attachments);
			this.manager.setConversationMessages(chatTitle.conversationId, messages);
			this.suggestionService.setSpecificSuggestionsFromMessages(messages);
			this.scrollRequests.next('last-user');
		});
	}

	/** Conversation supprimée côté backend (depuis l'historique). */
	deleteConversation(conversation: ChatTitle): void {
		this.generation.cancelConversation(conversation.conversationId);
		if (this.conversations.remove(conversation.conversationId)) {
			this.manager.initNewChat();
			this.suggestionService.clearSpecificSuggestions();
			this.scrollRequests.next('reset');
		}
		this.manager.deleteConversation(conversation.conversationId);
	}

	renameConversation(event: {conversationId: string; title: string}): void {
		this.conversations.rename(event.conversationId, event.title);
	}

	stopGeneration(): void {
		this.generation.stop();
	}

	decideToolApproval(answer: ChatMessage, {stepId, decision}: ToolApprovalRequest): void {
		this.generation.decideToolApproval(this.currentConversation()?.conversationId, answer.clientId, stepId, decision);
	}

	isReplayable(message: ChatMessage): boolean {
		const turn = this.replayableTurn();
		return !!turn && (message.clientId === turn.question.clientId || message.clientId === turn.answer.clientId);
	}

	regenerateLastAnswer(): void {
		const turn = this.replayableTurn();
		if (turn) this.replayTurn(turn, turn.question.message);
	}

	editLastQuestion(text: string): void {
		const turn = this.replayableTurn();
		if (turn && text?.trim()) this.replayTurn(turn, text.trim());
	}

	/**
	 * Renvoie une question déjà posée en imposant le workspace choisi par l'utilisateur (badge sous la question) :
	 * ajoute une nouvelle paire question/réponse, sans toucher à l'historique existant.
	 */
	changeWorkspace(event: {question: string; workspace: string}): void {
		if (event?.question && event.workspace) this.ask(event.question, event.workspace);
	}

	sendFeedback(feedback: Feedback): void {
		const conversationId = this.currentConversation().conversationId;
		this.feedbackService.sendAnswerFeedback({conversationId, ...feedback}).subscribe(() => this.notif.success('feedback.success'));
	}

	handleSuggestionAction(action: string): void {
		const result = this.suggestionService.handleSuggestionAction(action, this.messages());
		if (result.shouldShowForm) {
			this.form.set({def: result.formDef, group: result.formGroup});
		} else if (result.searchValue) {
			this.searchCtrl.setValue(result.searchValue);
		}
	}

	submitForm(): void {
		const {def, group} = this.form();
		this.form.set(undefined);
		this.searchCtrl.setValue(this.dfs.hydrate(def, group.getRawValue()));
		this.send();
	}

	closeForm(): void {
		this.form.set(undefined);
	}

	addAttachments(files: File[]): void {
		this.attachmentsStore.upload(files, this.currentConversation(), conversationId =>
			this.conversations.ensureCurrent('Processing attachments...', conversationId)
		);
	}

	retryAttachment(attachment: Attachment): void {
		this.attachmentsStore.retry(attachment, this.currentConversation());
	}

	removeAttachment(id: number): void {
		this.attachmentsStore.remove(id);
	}

	downloadAttachment(attachment: Attachment): void {
		this.attachmentsStore.download(attachment, this.currentConversation()?.conversationId);
	}

	refreshAttachmentsStatus(): void {
		this.attachmentsStore.refresh(this.currentConversation()?.conversationId);
	}

	private selectFaqOption(question: IQuestion): void {
		const conversationId = this.currentConversation()?.conversationId;
		const sourceType = question.url?.startsWith('http') ? 'URL' : 'FILE';
		const sources = question.url ? [{type: sourceType, link: question.url}] : undefined;
		this.manager.addMessage(conversationId, ChatMessageSource.USER, question.text, false, true, question.language, question.id);
		this.manager.addMessage(conversationId, ChatMessageSource.FAQ, question.answer.text, false, true, question.language, question.id, question.url, sources);
		this.clearSearch();
		this.scrollRequests.next('last-user');
		this.saveFaqExchange();
	}

	private saveFaqExchange(): void {
		if (!this.isRegistered()) return;
		const current = this.currentConversation();
		const messages = this.messages();
		if (current) {
			this.conversationService.update(current.conversationId, [messages.at(-2), messages.at(-1)]);
		} else {
			this.conversationService.init(messages).subscribe(() => this.conversations.refresh(true));
		}
	}

	private ask(text: string, workspace?: string): void {
		const conversationId = this.conversations.ensureCurrent(text);
		this.conversations.listProvisional(text);
		const question = this.manager.addMessage(conversationId, ChatMessageSource.USER, text);
		const answer = this.manager.addMessage(conversationId, ChatMessageSource.LLM, '', false, false);
		this.suggestionService.clearSpecificSuggestions();
		this.stream({conversationId, questionId: question.clientId, answerId: answer.clientId}, text, {workspace});
		this.scrollRequests.next('last-user');
	}

	/**
	 * Rejoue le dernier échange en remplaçant la réponse enregistrée (`id`, sinon `replaceableId`). La réponse est
	 * remplacée par un nouveau message : un flux précédent encore ouvert (génération du titre) ne peut ainsi pas
	 * modifier la nouvelle réponse. Si le backend refuse (409), le tour est rétabli.
	 */
	private replayTurn({question, answer}: ChatTurn, text: string): void {
		const conversationId = this.currentConversation()?.conversationId;
		if (!conversationId) return;
		const replaceMessageId = answer.id ?? answer.replaceableId;
		const next: ChatMessage = {
			clientId: uuidv4(),
			message: '',
			source: ChatMessageSource.LLM,
			timestamp: new Date(),
			isCompleted: false,
			sources: [],
			replaceableId: replaceMessageId
		};
		this.manager.replaceMessage(conversationId, answer.clientId, next);
		this.manager.patchMessage(conversationId, question.clientId, {message: text, workspace: undefined});
		const restore = () => {
			this.manager.replaceMessage(conversationId, next.clientId, answer);
			this.manager.patchMessage(conversationId, question.clientId, {message: question.message, workspace: question.workspace});
		};
		this.suggestionService.clearSpecificSuggestions();
		this.stream({conversationId, questionId: question.clientId, answerId: next.clientId}, text, {replaceMessageId, restore});
		this.scrollRequests.next('last-user');
	}

	private stream(target: StreamingTarget, query: string, {workspace, replaceMessageId, restore}: StreamOptions): void {
		const request = {
			query,
			conversationId: target.conversationId,
			language: LANGUAGE_MAP[this.translateService.getCurrentLang()] || Language.DE,
			workspace,
			replaceMessageId
		};
		this.generation.start(target, request, {
			restore,
			closed: () => this.conversations.refreshIfProvisional(target.conversationId),
			updated: () => this.scrollRequests.next('visibility')
		});
	}
}
