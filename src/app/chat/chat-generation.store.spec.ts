import {HttpErrorResponse} from '@angular/common/http';
import {TestBed} from '@angular/core/testing';
import {Subject, of, throwError} from 'rxjs';
import {ChatMessage, ChatMessageSource} from '../shared/model/chat-message';
import {ChatStreamEvent} from '../shared/model/chat-stream-event';
import {ConversationService} from '../shared/services/conversation.service';
import {DynamicFormService} from '../shared/services/dynamic-form.service';
import {RagService} from '../shared/services/rag.service';
import {StreamHttpError} from '../shared/services/sse-client.service';
import {NotificationMock, notificationMock, provideNotificationMock, provideTranslateStub} from '../../testing/angular';
import {streamEvents as ev} from '../../testing/stream-events';
import {ChatGenerationStore, STOP_TIMEOUT_MS, StreamingCallbacks, StreamingTarget} from './chat-generation.store';
import {ChatConversationManagerService, ChatSuggestionService} from './services';

describe('ChatGenerationStore', () => {
	let store: ChatGenerationStore;
	let manager: ChatConversationManagerService;
	let stream: Subject<ChatStreamEvent>;
	let ragService: {process: jest.Mock};
	let conversationService: {stopGeneration: jest.Mock; decideToolApproval: jest.Mock};
	let notif: NotificationMock;

	const CONVERSATION = 'c1';
	const emit = (...events: ChatStreamEvent[]): void => {
		events.forEach(event => stream.next(event));
		jest.advanceTimersByTime(20);
	};

	/** Paire question/réponse vide dans la conversation, puis démarrage de la génération. */
	const start = (callbacks: StreamingCallbacks = {}): StreamingTarget => {
		const question = manager.addMessage(CONVERSATION, ChatMessageSource.USER, 'Question');
		const answer = manager.addMessage(CONVERSATION, ChatMessageSource.LLM, '', false, false);
		const target = {conversationId: CONVERSATION, questionId: question.clientId, answerId: answer.clientId};
		store.start(target, {query: 'Question', conversationId: CONVERSATION}, callbacks);
		return target;
	};
	const answerOf = (target: StreamingTarget): ChatMessage => manager.find(CONVERSATION, target.answerId);

	beforeEach(() => {
		jest.useFakeTimers();
		ragService = {process: jest.fn(() => (stream = new Subject<ChatStreamEvent>()))};
		conversationService = {stopGeneration: jest.fn(() => of(undefined)), decideToolApproval: jest.fn(() => of(undefined))};
		notif = notificationMock();
		TestBed.configureTestingModule({
			providers: [
				ChatGenerationStore,
				{provide: RagService, useValue: ragService},
				{provide: ConversationService, useValue: conversationService},
				{provide: DynamicFormService, useValue: {}},
				provideTranslateStub(),
				provideNotificationMock(notif)
			]
		});
		store = TestBed.inject(ChatGenerationStore);
		manager = TestBed.inject(ChatConversationManagerService);
		manager.clearConversation(CONVERSATION);
	});

	afterEach(() => jest.useRealTimers());

	it('retire les paramètres vides de la requête', () => {
		manager.addMessage(CONVERSATION, ChatMessageSource.LLM, '', false, false);
		store.start(
			{conversationId: CONVERSATION, questionId: 'q', answerId: 'a'},
			{query: 'Q', conversationId: CONVERSATION, workspace: '', replaceMessageId: null}
		);

		expect(ragService.process).toHaveBeenCalledWith({query: 'Q', conversationId: CONVERSATION});
	});

	it('affiche le workspace utilisé sous la question et ajoute les suggestions de la réponse', () => {
		const updated = jest.fn();
		const target = start({updated});

		emit(ev.start('g1'), ev.workspace('AVS'), ev.suggestion('ii-salary'), ev.text('Réponse'));

		expect(manager.find(CONVERSATION, target.questionId).workspace).toBe('AVS');
		expect(TestBed.inject(ChatSuggestionService).getSpecificSuggestions()).toEqual([{text: 'action_suggestions.ii-salary', action: 'ii-salary'}]);
		expect(updated).toHaveBeenCalledTimes(1);
	});

	it('met la réponse en erreur à la réception d’un événement `error`', () => {
		const target = start();

		emit(ev.start('g1'), ev.text('Début'), ev.error('LLM_UNAVAILABLE'));

		expect(answerOf(target)).toEqual(expect.objectContaining({message: 'chat.stream.error', inError: true, isCompleted: true, sources: []}));
		expect(store.isGenerating()).toBe(false);
	});

	it('ignore les événements d’une réponse retirée du cache', () => {
		const target = start();
		manager.clearConversation(CONVERSATION);

		emit(ev.text('Perdu'));

		expect(answerOf(target)).toBeUndefined();
		expect(store.isGenerating()).toBe(false);
	});

	it('n’enregistre pas un flux déjà terminé à l’abonnement', () => {
		ragService.process.mockReturnValue(of(ev.start('g1'), ev.text('Vite'), ev.done('a1')));
		const closed = jest.fn();

		const target = start({closed});

		expect(answerOf(target)).toEqual(expect.objectContaining({id: 'a1', message: 'Vite', isCompleted: true}));
		expect(closed).toHaveBeenCalled();
		expect(store.isGenerating()).toBe(false);
	});

	describe('fin du flux sans `done`', () => {
		it('conserve la réponse partielle comme interrompue, rejouable par son identifiant de génération', () => {
			const closed = jest.fn();
			const target = start({closed});
			emit(ev.start('g1'), ev.text('Partiel'));

			stream.complete();

			expect(answerOf(target)).toEqual(expect.objectContaining({message: 'Partiel', isCompleted: true, interrupted: true, replaceableId: 'g1'}));
			expect(closed).toHaveBeenCalled();
		});

		it('met en erreur une réponse vide', () => {
			const target = start();
			emit(ev.start('g1'));

			stream.complete();

			expect(answerOf(target)).toEqual(expect.objectContaining({message: 'chat.stream.error.incomplete', inError: true}));
		});

		it('met en erreur une réponse encore sur une étape de statut', () => {
			const target = start();
			emit(ev.start('g1'), ev.status('SEARCHING'));

			stream.complete();

			expect(answerOf(target).inError).toBe(true);
		});
	});

	describe('erreurs HTTP du flux', () => {
		it('409 sans tour à rétablir : la réponse passe en erreur de conflit', () => {
			const target = start();

			stream.error(new StreamHttpError(409, 'Conflict', 'GENERATION_IN_PROGRESS'));

			expect(answerOf(target)).toEqual(expect.objectContaining({message: 'chat.stream.error.conflict', inError: true}));
			expect(notif.warning).not.toHaveBeenCalled();
		});

		it('409 avec tour à rétablir : rétablit et avertit', () => {
			const restore = jest.fn();
			start({restore});

			stream.error(new StreamHttpError(409, 'Conflict'));

			expect(restore).toHaveBeenCalled();
			expect(notif.warning).toHaveBeenCalledWith('chat.stream.error.conflict');
		});

		it('401 : session expirée', () => {
			const target = start();

			stream.error(new StreamHttpError(401, 'Unauthorized'));

			expect(answerOf(target).message).toBe('chat.stream.error.session');
		});

		it('autre erreur : la réponse partielle est conservée', () => {
			const target = start();
			emit(ev.start('g1'), ev.text('Partiel'));

			stream.error(new Error('réseau'));

			expect(answerOf(target)).toEqual(expect.objectContaining({message: 'Partiel', interrupted: true}));
			expect(store.isGenerating()).toBe(false);
		});
	});

	describe('Stop', () => {
		it('abandonne immédiatement une génération pas encore annoncée par `start`', () => {
			const target = start();

			store.stop();

			expect(conversationService.stopGeneration).not.toHaveBeenCalled();
			expect(stream.observed).toBe(false);
			expect(answerOf(target)).toEqual(expect.objectContaining({isCompleted: true, interrupted: true}));
		});

		it('abandonne la requête si l’arrêt échoue côté backend', () => {
			conversationService.stopGeneration.mockReturnValue(throwError(() => new HttpErrorResponse({status: 404})));
			const target = start();
			emit(ev.start('g1'), ev.text('Sal'));

			store.stop();

			expect(stream.observed).toBe(false);
			expect(answerOf(target)).toEqual(expect.objectContaining({message: 'Sal', interrupted: true, replaceableId: 'g1'}));
			expect(store.isStopping()).toBe(false);
		});

		it('ne relance pas l’arrêt d’une génération déjà en cours d’arrêt ni terminée', () => {
			conversationService.stopGeneration.mockReturnValue(new Subject());
			start();
			emit(ev.start('g1'));

			store.stop();
			store.stop();

			expect(conversationService.stopGeneration).toHaveBeenCalledTimes(1);
			expect(store.isStopping()).toBe(true);

			emit(ev.done('a1', true));
			jest.advanceTimersByTime(STOP_TIMEOUT_MS);
			store.stop();

			expect(conversationService.stopGeneration).toHaveBeenCalledTimes(1);
			expect(stream.observed).toBe(true);
		});
	});

	describe('annulations', () => {
		it('cancelPending laisse se terminer un flux dont la réponse est complète (génération du titre)', () => {
			const closed = jest.fn();
			start({closed});
			emit(ev.start('g1'), ev.done('a1'));

			store.cancelPending();

			expect(stream.observed).toBe(true);
			stream.complete();
			expect(closed).toHaveBeenCalled();
		});

		it('cancelPending abandonne les réponses inachevées', () => {
			const target = start();
			emit(ev.start('g1'), ev.text('Sal'));

			store.cancelPending();

			expect(stream.observed).toBe(false);
			expect(answerOf(target).interrupted).toBe(true);
		});

		it('cancelConversation ne touche qu’aux flux de la conversation', () => {
			start();
			const first = stream;
			manager.addMessage('autre', ChatMessageSource.LLM, '', false, false);
			store.start({conversationId: 'autre', questionId: 'q', answerId: 'a'}, {query: 'Q'});

			store.cancelConversation('autre');

			expect(first.observed).toBe(true);
			expect(stream.observed).toBe(false);
			manager.clearConversation('autre');
		});
	});

	describe('approbation d’outil', () => {
		const awaitApproval = (): StreamingTarget => {
			const target = start();
			emit(ev.start('g1'), ev.toolCall('t1', 'get_attachment_content'), {
				type: 'approval_required',
				data: {id: 't1', approvalId: 'ap1', name: 'get_attachment_content', arguments: {}, expiresAt: '2030-01-01T00:00:00Z'}
			});
			return target;
		};

		it('ignore une étape sans demande d’approbation', () => {
			const target = awaitApproval();

			store.decideToolApproval(CONVERSATION, target.answerId, 'inconnue', 'APPROVE');

			expect(conversationService.decideToolApproval).not.toHaveBeenCalled();
		});

		it('annule la décision et notifie en cas d’erreur autre que 404', () => {
			conversationService.decideToolApproval.mockReturnValue(throwError(() => new HttpErrorResponse({status: 500})));
			const target = awaitApproval();

			store.decideToolApproval(CONVERSATION, target.answerId, 't1', 'APPROVE');

			expect(answerOf(target).toolSteps[0].approval).toEqual(expect.objectContaining({sending: false, decision: undefined}));
			expect(notif.error).toHaveBeenCalledWith('chat.tools.approval.error');
		});
	});
});
