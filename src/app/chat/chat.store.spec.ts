import {TestBed} from '@angular/core/testing';
import {TranslateService} from '@ngx-translate/core';
import {ObNotificationService} from '@oblique/oblique';
import {BehaviorSubject, Subject, of} from 'rxjs';
import {ChatTitle, ConversationType} from '../shared/model/chat-history';
import {ChatMessageSource} from '../shared/model/chat-message';
import {ChatStreamEvent} from '../shared/model/chat-stream-event';
import {UserStatus} from '../shared/model/user';
import {AuthenticationServiceV2} from '../shared/services/auth.service';
import {ConversationService} from '../shared/services/conversation.service';
import {DynamicFormService} from '../shared/services/dynamic-form.service';
import {FeedbackService} from '../shared/services/feedback.service';
import {RagService} from '../shared/services/rag.service';
import {StreamHttpError} from '../shared/services/sse-client.service';
import {ChatAttachmentsStore} from './chat-attachments.store';
import {ChatConversationsStore} from './chat-conversations.store';
import {ChatGenerationStore, STOP_TIMEOUT_MS} from './chat-generation.store';
import {ChatStore} from './chat.store';
import {ChatAutocompleteService} from './services';

describe('ChatStore', () => {
	let store: ChatStore;
	let stream: Subject<ChatStreamEvent>;
	let ragService: {process: jest.Mock};
	let conversationService: {getConversationTitles: jest.Mock; getConversation: jest.Mock; stopGeneration: jest.Mock};
	let notif: {success: jest.Mock; warning: jest.Mock; error: jest.Mock};

	const flushFrame = (): void => {
		jest.advanceTimersByTime(20);
	};
	const emit = (...events: ChatStreamEvent[]): void => {
		events.forEach(event => stream.next(event));
		flushFrame();
	};
	const answer = () => store.messages().at(-1);

	const ask = (question: string): void => {
		store.searchCtrl.setValue(question);
		store.send();
	};

	const completeTurn = (): void => {
		ask('Bonjour');
		emit({type: 'start', data: {messageId: 'g1'}}, {type: 'text_delta', data: {text: 'Salut'}}, {type: 'done', data: {messageId: 'a1', interrupted: false}});
		stream.complete();
	};

	beforeEach(() => {
		jest.useFakeTimers();
		ragService = {process: jest.fn(() => (stream = new Subject<ChatStreamEvent>()))};
		conversationService = {
			getConversationTitles: jest.fn(() => of([])),
			getConversation: jest.fn(),
			stopGeneration: jest.fn(() => of(undefined))
		};
		notif = {success: jest.fn(), warning: jest.fn(), error: jest.fn()};
		TestBed.configureTestingModule({
			providers: [
				ChatStore,
				ChatConversationsStore,
				ChatGenerationStore,
				ChatAttachmentsStore,
				{provide: RagService, useValue: ragService},
				{provide: ConversationService, useValue: conversationService},
				{provide: AuthenticationServiceV2, useValue: {$authenticatedUser: new BehaviorSubject({status: UserStatus.ACTIVE})}},
				{provide: TranslateService, useValue: {instant: (key: string) => key, getCurrentLang: () => 'fr'}},
				{provide: ObNotificationService, useValue: notif},
				{provide: FeedbackService, useValue: {}},
				{provide: DynamicFormService, useValue: {}},
				{provide: ChatAutocompleteService, useValue: {getOptionService: jest.fn(), getOptionLabel: jest.fn(), isCommand: jest.fn()}}
			]
		});
		store = TestBed.inject(ChatStore);
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it('envoie la question puis affiche la réponse au fil du flux jusqu’à `done`', () => {
		ask('Bonjour');

		expect(ragService.process).toHaveBeenCalledWith(expect.objectContaining({query: 'Bonjour', ragEnabled: true}));
		expect(store.messages().map(message => message.source)).toEqual([ChatMessageSource.USER, ChatMessageSource.LLM]);
		expect(store.conversationTitles()[0].title).toBe('Bonjour');
		expect(store.isGenerating()).toBe(true);
		expect(store.searchCtrl.value).toBe('');

		const empty = answer();
		emit({type: 'start', data: {messageId: 'g1'}}, {type: 'text_delta', data: {text: 'Sal'}}, {type: 'text_delta', data: {text: 'ut'}});
		expect(answer()).not.toBe(empty);
		expect(answer().message).toBe('Salut');
		expect(answer().isCompleted).toBe(false);

		emit({type: 'done', data: {messageId: 'a1', interrupted: false}});
		expect(answer()).toEqual(expect.objectContaining({id: 'a1', message: 'Salut', isCompleted: true}));
		expect(store.isGenerating()).toBe(false);
	});

	it('remplace le titre provisoire par le titre généré à la fermeture du flux', () => {
		ask('Bonjour');
		const conversationId = store.currentConversation().conversationId;
		conversationService.getConversationTitles.mockReturnValue(of([{conversationId, title: 'Salutations', timestamp: new Date()}]));

		emit({type: 'done', data: {messageId: 'a1', interrupted: false}});
		stream.complete();

		expect(store.conversationTitles()).toEqual([expect.objectContaining({conversationId, title: 'Salutations', selected: true})]);
		expect(store.currentConversation().title).toBe('Salutations');
	});

	it('Stop : demande l’arrêt au backend puis conserve la réponse partielle à la réception de `done`', () => {
		ask('Bonjour');
		emit({type: 'start', data: {messageId: 'g1'}}, {type: 'text_delta', data: {text: 'Sal'}});

		store.stopGeneration();

		const conversationId = store.currentConversation().conversationId;
		expect(conversationService.stopGeneration).toHaveBeenCalledWith(conversationId, 'g1');
		expect(store.isStopping()).toBe(true);

		emit({type: 'done', data: {messageId: 'a1', interrupted: true}});
		expect(answer()).toEqual(expect.objectContaining({id: 'a1', message: 'Sal', isCompleted: true, interrupted: true}));
		expect(store.isStopping()).toBe(false);
		expect(store.isGenerating()).toBe(false);
	});

	it('Stop : abandonne la requête si le backend ne répond pas dans le délai', () => {
		ask('Bonjour');
		emit({type: 'start', data: {messageId: 'g1'}}, {type: 'text_delta', data: {text: 'Sal'}});

		store.stopGeneration();
		jest.advanceTimersByTime(STOP_TIMEOUT_MS);

		expect(stream.observed).toBe(false);
		expect(answer()).toEqual(expect.objectContaining({message: 'Sal', isCompleted: true, interrupted: true, replaceableId: 'g1'}));
		expect(store.isGenerating()).toBe(false);
	});

	it('Régénérer : remplace la dernière réponse et la rétablit si le backend refuse (409)', () => {
		completeTurn();
		const [question, previous] = store.messages();

		store.regenerateLastAnswer();

		expect(ragService.process).toHaveBeenLastCalledWith(expect.objectContaining({query: 'Bonjour', replaceMessageId: 'a1'}));
		expect(answer().clientId).not.toBe(previous.clientId);
		expect(answer().message).toBe('');

		stream.error(new StreamHttpError(409, 'Conflict', 'TURN_NOT_REPLACEABLE'));

		expect(store.messages()).toEqual([question, previous]);
		expect(notif.warning).toHaveBeenCalledWith('chat.stream.error.not-replaceable');
		expect(store.isGenerating()).toBe(false);
	});

	it('Modifier la dernière question : rejoue le tour avec le nouveau texte', () => {
		completeTurn();

		store.editLastQuestion('  Bonsoir ');

		expect(ragService.process).toHaveBeenLastCalledWith(expect.objectContaining({query: 'Bonsoir', replaceMessageId: 'a1'}));
		expect(store.messages()[0].message).toBe('Bonsoir');
	});

	it('ouvre une conversation de l’historique avec ses messages et son mode', () => {
		const title: ChatTitle = {conversationId: 'c1', title: 'Capitale', timestamp: new Date(), type: ConversationType.NO_RAG};
		conversationService.getConversationTitles.mockReturnValue(of([title]));
		conversationService.getConversation.mockReturnValue(
			of({
				messages: [
					{messageId: 'q1', conversationId: 'c1', message: 'Capitale ?', role: 'user', timestamp: new Date(), language: 'fr'},
					{messageId: 'a1', conversationId: 'c1', message: 'Paris', role: 'assistant', timestamp: new Date(), language: 'fr', suggestions: ['ii-salary']}
				],
				attachments: []
			})
		);
		store.newChat();
		TestBed.inject(ChatConversationsStore).loadTitles();

		store.selectConversation(title);

		expect(conversationService.getConversation).toHaveBeenCalledWith('c1');
		expect(store.currentConversation().conversationId).toBe('c1');
		expect(store.conversationTitles()[0].selected).toBe(true);
		expect(store.messages().map(message => message.message)).toEqual(['Capitale ?', 'Paris']);
		expect(store.isLlmOnlyMode()).toBe(true);
		expect(store.suggestions().at(-1)).toEqual({text: 'action_suggestions.ii-salary', action: 'ii-salary'});
		expect(store.replayableTurn()?.answer.id).toBe('a1');
	});
});
