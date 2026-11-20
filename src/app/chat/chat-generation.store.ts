import {Injectable, OnDestroy, computed, inject, signal} from '@angular/core';
import {TranslateService} from '@ngx-translate/core';
import {ObNotificationService} from '@oblique/oblique';
import {EMPTY, Subscription, merge, switchMap, timeout, timer} from 'rxjs';
import {ChatMessage, ChatMessageSource} from '../shared/model/chat-message';
import {ChatRequest} from '../shared/model/rag';
import {ChatStreamEvent} from '../shared/model/chat-stream-event';
import {ConversationService} from '../shared/services/conversation.service';
import {RagService} from '../shared/services/rag.service';
import {StreamHttpError} from '../shared/services/sse-client.service';
import {FrameBatcher} from '../shared/utils/frame-batcher';
import {clearNullAndEmpty} from '../shared/utils/zco-utils';
import {ChatConversationManagerService, ChatStreamProcessorService, ChatSuggestionService} from './services';

/** Délai maximal entre la demande de Stop et `done` ; au-delà, la requête est abandonnée côté client. */
export const STOP_TIMEOUT_MS = 10_000;

/** Paire question/réponse alimentée par une requête de streaming (messages identifiés par `clientId`). */
export interface StreamingTarget {
	conversationId: string;
	questionId: string;
	answerId: string;
}

export interface StreamingCallbacks {
	/** Régénération refusée (409) : rétablit le tour tel qu'il était avant. */
	restore?: () => void;
	/** Fin du flux (il ne se termine qu'après la persistance de l'échange et la génération du titre). */
	closed?: () => void;
	/** Lot d'événements appliqué (au plus une fois par frame). */
	updated?: () => void;
}

interface ActiveStream {
	subscription: Subscription;
	batcher: FrameBatcher<ChatStreamEvent>;
	/** Demande de Stop et attente de `done` (abandon de la requête au-delà de STOP_TIMEOUT_MS). */
	stop?: Subscription;
}

/**
 * Générations en cours (plusieurs peuvent coexister, une par paire question/réponse) : streaming, Stop,
 * abandon et erreurs. Les événements sont appliqués par lot (une frame), chaque lot remplaçant la réponse.
 */
@Injectable()
export class ChatGenerationStore implements OnDestroy {
	/** Une réponse est en cours de génération (avant `done` ou `error`). */
	readonly isGenerating = computed(() => this.targets().some(target => this.answerOf(target)?.isCompleted === false));
	/** Stop demandé, en attente de l'enregistrement de la réponse partielle. */
	readonly isStopping = computed(() => this.targets().some(target => !!this.answerOf(target)?.stopping));
	private readonly targets = signal<StreamingTarget[]>([]);
	private readonly streams = new Map<StreamingTarget, ActiveStream>();
	private readonly ragService = inject(RagService);
	private readonly conversationService = inject(ConversationService);
	private readonly manager = inject(ChatConversationManagerService);
	private readonly streamProcessor = inject(ChatStreamProcessorService);
	private readonly suggestionService = inject(ChatSuggestionService);
	private readonly translateService = inject(TranslateService);
	private readonly notif = inject(ObNotificationService);

	ngOnDestroy(): void {
		this.cancelPending();
	}

	start(target: StreamingTarget, request: ChatRequest, callbacks: StreamingCallbacks = {}): void {
		const batcher = new FrameBatcher<ChatStreamEvent>(events => this.applyEvents(target, events, callbacks));
		const subscription = this.ragService.process(clearNullAndEmpty(request)).subscribe({
			next: event => batcher.push(event),
			error: err => {
				batcher.flush();
				this.removeStream(target);
				this.handleStreamError(err, target, callbacks);
			},
			complete: () => {
				batcher.flush();
				this.removeStream(target);
				this.completeUnfinishedAnswer(target);
				callbacks.closed?.();
			}
		});
		if (!subscription.closed) {
			this.streams.set(target, {subscription, batcher});
			this.targets.update(targets => [...targets, target]);
		}
	}

	/**
	 * Stop : le backend arrête la génération, enregistre la réponse partielle puis termine le flux par
	 * `done {interrupted: true}` ; Régénérer n'est possible qu'après. Sans réponse du backend, la requête est abandonnée.
	 */
	stop(): void {
		this.streams.forEach((stream, target) => {
			const answer = this.answerOf(target);
			if (!answer || answer.isCompleted || answer.stopping) return;
			if (!answer.generationId) {
				this.abort(target);
				return;
			}
			this.manager.patchMessage(target.conversationId, target.answerId, {stopping: true});
			stream.stop = merge(
				this.conversationService.stopGeneration(target.conversationId, answer.generationId).pipe(
					timeout(STOP_TIMEOUT_MS),
					switchMap(() => EMPTY)
				),
				timer(STOP_TIMEOUT_MS)
			).subscribe({
				next: () => this.abort(target),
				error: () => this.abort(target)
			});
		});
	}

	/**
	 * Annule les générations dont la réponse n'est pas encore terminée (pas de `done`).
	 * Les flux déjà terminés côté réponse continuent : le backend y génère le titre.
	 */
	cancelPending(): void {
		this.streams.forEach(({batcher}, target) => {
			batcher.flush();
			// Réponse absente (conversation retirée du cache) : rien ne garantit qu'elle soit terminée.
			if (!this.answerOf(target)?.isCompleted) this.abort(target);
		});
	}

	/** Conversation supprimée : ses flux sont abandonnés, génération du titre comprise. */
	cancelConversation(conversationId: string): void {
		this.streams.forEach((stream, target) => {
			if (target.conversationId !== conversationId) return;
			stream.subscription.unsubscribe();
			this.removeStream(target);
		});
	}

	private answerOf(target: StreamingTarget): ChatMessage | undefined {
		return this.manager.find(target.conversationId, target.answerId);
	}

	private applyEvents(target: StreamingTarget, events: ChatStreamEvent[], callbacks: StreamingCallbacks): void {
		const answer = this.answerOf(target);
		if (!answer) return;
		const result = this.streamProcessor.apply(answer, events);
		this.manager.replaceMessage(target.conversationId, target.answerId, result.failed ? this.inError(result.message, 'chat.stream.error') : result.message);
		// Le workspace utilisé pour répondre est affiché sous la question plutôt que dans la réponse.
		const workspace = result.message.workspace;
		if (workspace && this.manager.find(target.conversationId, target.questionId)?.workspace !== workspace) {
			this.manager.patchMessage(target.conversationId, target.questionId, {workspace});
		}
		result.newSuggestions.forEach(suggestion => this.suggestionService.addSpecificSuggestion(suggestion));
		if (result.completed) this.streams.get(target)?.stop?.unsubscribe();
		callbacks.updated?.();
	}

	private removeStream(target: StreamingTarget): void {
		this.streams.get(target)?.stop?.unsubscribe();
		this.streams.delete(target);
		this.targets.update(targets => targets.filter(t => t !== target));
	}

	/**
	 * Abandon de la requête (navigation, Stop sans réponse du backend) : le backend enregistre la réponse partielle
	 * sous `generationId`, qui devient la réponse à remplacer pour rejouer ce tour.
	 */
	private abort(target: StreamingTarget): void {
		const stream = this.streams.get(target);
		if (!stream) return;
		stream.batcher.flush();
		const answer = this.answerOf(target);
		if (answer?.isCompleted) return;
		stream.subscription.unsubscribe();
		this.removeStream(target);
		if (answer) this.manager.replaceMessage(target.conversationId, target.answerId, this.interruptedWithoutDone(answer));
	}

	/** Réponse arrêtée sans `done` : conservée comme interrompue, rejouable via l'identifiant annoncé par `start`. */
	private interruptedWithoutDone(answer: ChatMessage): ChatMessage {
		const interrupted = this.streamProcessor.interrupt(answer);
		return {...interrupted, replaceableId: interrupted.generationId ?? interrupted.replaceableId};
	}

	/**
	 * Flux fermé sans `done` ni `error` (coupure réseau, proxy) : rien ne garantit que l'échange a été enregistré.
	 * La réponse partielle est conservée comme interrompue, sinon la réponse passe en erreur.
	 */
	private completeUnfinishedAnswer(target: StreamingTarget): void {
		const answer = this.answerOf(target);
		if (!answer || answer.isCompleted) return;
		if (answer.message && !answer.status) {
			this.manager.replaceMessage(target.conversationId, target.answerId, this.interruptedWithoutDone(answer));
		} else {
			this.markAnswerInError(target, 'chat.stream.error.incomplete');
		}
	}

	private handleStreamError(err: unknown, target: StreamingTarget, {restore}: StreamingCallbacks): void {
		if (err instanceof StreamHttpError && err.status === 409) {
			const key = err.code === 'TURN_NOT_REPLACEABLE' ? 'chat.stream.error.not-replaceable' : 'chat.stream.error.conflict';
			if (restore) {
				restore();
				this.notif.warning(key);
			} else {
				this.markAnswerInError(target, key);
			}
		} else if (err instanceof StreamHttpError && err.status === 401) {
			this.markAnswerInError(target, 'chat.stream.error.session');
		} else {
			this.completeUnfinishedAnswer(target);
		}
	}

	private markAnswerInError(target: StreamingTarget, messageKey: string): void {
		const answer = this.answerOf(target);
		if (answer) this.manager.replaceMessage(target.conversationId, target.answerId, this.inError(answer, messageKey));
	}

	private inError(answer: ChatMessage, messageKey: string): ChatMessage {
		return {
			...answer,
			message: this.translateService.instant(messageKey),
			source: ChatMessageSource.LLM,
			timestamp: new Date(),
			isCompleted: true,
			inError: true,
			sources: []
		};
	}
}
