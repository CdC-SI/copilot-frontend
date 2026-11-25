import {TestBed} from '@angular/core/testing';
import {HttpErrorResponse} from '@angular/common/http';
import {BehaviorSubject, Subject, of, throwError} from 'rxjs';
import {ChatTitle} from '../shared/model/chat-history';
import {ChatMessageSource} from '../shared/model/chat-message';
import {ChatStreamEvent} from '../shared/model/chat-stream-event';
import {AuthenticationServiceV2} from '../shared/services/auth.service';
import {ConversationService} from '../shared/services/conversation.service';
import {DynamicFormService} from '../shared/services/dynamic-form.service';
import {FeedbackService} from '../shared/services/feedback.service';
import {RagService} from '../shared/services/rag.service';
import {StreamHttpError} from '../shared/services/sse-client.service';
import {ChatAttachmentsStore} from './chat-attachments.store';
import {ChatConversationsStore} from './chat-conversations.store';
import {ChatScrollRequest} from './chat.models';
import {ChatGenerationStore, STOP_TIMEOUT_MS} from './chat-generation.store';
import {ChatStore} from './chat.store';
import {ChatAutocompleteService, ChatSuggestionService} from './services';
import {IQuestion, Language} from '../shared/model/answer';
import {IUser, UserStatus} from '../shared/model/user';
import {FormGroup} from '@angular/forms';
import {NotificationMock, notificationMock, provideNotificationMock, provideTranslateStub} from '../../testing/angular';
import {aUser} from '../../testing/fixtures';
import {answerTurn} from '../../testing/stream-events';

describe('ChatStore', () => {
	let store: ChatStore;
	let stream: Subject<ChatStreamEvent>;
	let ragService: {process: jest.Mock};
	let conversationService: {
		getConversationTitles: jest.Mock;
		getConversation: jest.Mock;
		stopGeneration: jest.Mock;
		decideToolApproval: jest.Mock;
		init: jest.Mock;
		update: jest.Mock;
		uploadAttachments: jest.Mock;
	};
	let feedbackService: {sendAnswerFeedback: jest.Mock};
	let autocompleteService: {getOptionService: jest.Mock; getOptionLabel: jest.Mock; isCommand: jest.Mock};
	let user$: BehaviorSubject<IUser>;
	let notif: NotificationMock;

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
		emit(...answerTurn('Salut'));
		stream.complete();
	};

	beforeEach(() => {
		jest.useFakeTimers();
		ragService = {process: jest.fn(() => (stream = new Subject<ChatStreamEvent>()))};
		conversationService = {
			getConversationTitles: jest.fn(() => of([])),
			getConversation: jest.fn(),
			stopGeneration: jest.fn(() => of(undefined)),
			decideToolApproval: jest.fn(() => of(undefined)),
			init: jest.fn(() => of({})),
			update: jest.fn(),
			uploadAttachments: jest.fn(() => new Subject())
		};
		feedbackService = {sendAnswerFeedback: jest.fn(() => of(undefined))};
		autocompleteService = {getOptionService: jest.fn(() => 'options'), getOptionLabel: jest.fn(() => 'libellé'), isCommand: jest.fn(() => false)};
		user$ = new BehaviorSubject(aUser());
		notif = notificationMock();
		TestBed.configureTestingModule({
			providers: [
				ChatStore,
				ChatConversationsStore,
				ChatGenerationStore,
				ChatAttachmentsStore,
				{provide: RagService, useValue: ragService},
				{provide: ConversationService, useValue: conversationService},
				{provide: AuthenticationServiceV2, useValue: {$authenticatedUser: user$}},
				provideTranslateStub(),
				provideNotificationMock(notif),
				{provide: FeedbackService, useValue: feedbackService},
				{provide: DynamicFormService, useValue: {hydrate: jest.fn(() => 'Message hydraté')}},
				{provide: ChatAutocompleteService, useValue: autocompleteService}
			]
		});
		store = TestBed.inject(ChatStore);
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it('envoie la question puis affiche la réponse au fil du flux jusqu’à `done`', () => {
		const scrolls: ChatScrollRequest[] = [];
		store.scrollRequests.subscribe(request => scrolls.push(request));
		ask('Bonjour');

		// Question envoyée : le tour est épinglé en haut du fil.
		expect(scrolls).toContain('last-user');

		expect(ragService.process).toHaveBeenCalledWith(expect.objectContaining({query: 'Bonjour'}));
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

	it('abandonne le flux d’une conversation supprimée pendant la génération', () => {
		ask('Bonjour');
		emit({type: 'start', data: {messageId: 'g1'}});
		expect(stream.observed).toBe(true);

		store.deleteConversation(store.currentConversation());

		expect(stream.observed).toBe(false);
		expect(store.isGenerating()).toBe(false);
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

	describe('approbation d’un outil', () => {
		const requestApproval = (): void => {
			ask('Lis la pièce jointe');
			emit(
				{type: 'start', data: {messageId: 'g1'}},
				{type: 'tool_call', data: {id: 't1', name: 'get_attachment_content', arguments: {}}},
				{type: 'approval_required', data: {id: 't1', approvalId: 'ap1', name: 'get_attachment_content', arguments: {}, expiresAt: '2030-01-01T00:00:00Z'}}
			);
		};

		it('envoie la décision au backend et la mémorise sur l’étape', () => {
			requestApproval();

			store.decideToolApproval(answer(), {stepId: 't1', decision: 'APPROVE'});

			expect(conversationService.decideToolApproval).toHaveBeenCalledWith(store.currentConversation().conversationId, 'ap1', 'APPROVE');
			expect(answer().toolSteps[0].approval).toEqual(expect.objectContaining({decision: 'APPROVE', sending: false}));
			expect(answer().toolSteps[0].status).toBe('awaiting_approval');
		});

		it('marque la demande comme indisponible si le backend ne la connaît plus (404)', () => {
			conversationService.decideToolApproval.mockReturnValue(throwError(() => new HttpErrorResponse({status: 404})));
			requestApproval();

			store.decideToolApproval(answer(), {stepId: 't1', decision: 'REJECT'});

			expect(answer().toolSteps[0].approval).toEqual(expect.objectContaining({sending: false, unavailable: true}));
			expect(notif.error).not.toHaveBeenCalled();
		});
	});

	it('ouvre une conversation de l’historique avec ses messages', () => {
		const title: ChatTitle = {conversationId: 'c1', title: 'Capitale', timestamp: new Date()};
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
		const scrolls: ChatScrollRequest[] = [];
		store.scrollRequests.subscribe(request => scrolls.push(request));

		store.selectConversation(title);

		// Conversation ouverte depuis l'historique : pas d'espace épinglé sous le dernier tour.
		expect(scrolls).toEqual(['opened']);

		expect(conversationService.getConversation).toHaveBeenCalledWith('c1');
		expect(store.currentConversation().conversationId).toBe('c1');
		expect(store.conversationTitles()[0].selected).toBe(true);
		expect(store.messages().map(message => message.message)).toEqual(['Capitale ?', 'Paris']);
		expect(store.suggestions().at(-1)).toEqual({text: 'action_suggestions.ii-salary', action: 'ii-salary'});
		expect(store.replayableTurn()?.answer.id).toBe('a1');
	});

	describe('saisie', () => {
		it('bloque l’envoi sans texte ou pendant l’envoi d’une pièce jointe', () => {
			expect(store.canSend()).toBe(false);
			store.searchCtrl.setValue('Question');
			expect(store.canSend()).toBe(true);

			store.addAttachments([new File(['x'], 'a.pdf')]);
			expect(store.canSend()).toBe(false);
		});

		it('désactive la saisie pendant la génération', () => {
			ask('Bonjour');
			TestBed.tick();
			expect(store.searchCtrl.disabled).toBe(true);

			emit({type: 'done', data: {messageId: 'a1', interrupted: false}});
			TestBed.tick();
			expect(store.searchCtrl.enabled).toBe(true);
		});

		it('passe en mode commande sur « / » et en délègue les options', () => {
			store.setCommandMode('/res');
			expect(store.commandMode()).toBe(true);
			expect(store.optionService()).toBe('options');
			expect(autocompleteService.getOptionService).toHaveBeenLastCalledWith(true, false);
			expect(store.optionLabel({name: '/resume', description: '', example: ''})).toBe('libellé');

			store.setCommandMode(undefined);
			expect(store.commandMode()).toBe(false);
		});

		it('reprend le nom d’une commande choisie', () => {
			autocompleteService.isCommand.mockReturnValue(true);

			store.selectOption({name: '/resume', description: '', example: ''});

			expect(store.searchCtrl.value).toBe('/resume');
		});

		it('pose la question avec la langue de l’interface', () => {
			ask('Bonjour');

			expect(ragService.process).toHaveBeenCalledWith(expect.objectContaining({language: Language.FR}));
		});

		it('expose le prénom de l’utilisateur', () => {
			expect(store.userFirstName()).toBe('Ada');

			user$.next(aUser({firstName: '  '}));
			expect(store.userFirstName()).toBeNull();
		});
	});

	describe('question de la FAQ', () => {
		const faq = {id: 'faq-9', text: 'Âge de la retraite ?', answer: {text: '65 ans'}, language: Language.FR, url: 'https://ahv.ch/retraite'} as IQuestion;

		it('affiche la question et la réponse de la FAQ, puis enregistre une nouvelle conversation', () => {
			conversationService.getConversationTitles.mockReturnValue(of([{conversationId: 'srv', title: 'Retraite', timestamp: new Date()}]));

			store.selectOption(faq);

			expect(ragService.process).not.toHaveBeenCalled();
			expect(conversationService.init).toHaveBeenCalledWith([
				expect.objectContaining({source: ChatMessageSource.USER, message: 'Âge de la retraite ?', faqItemId: 'faq-9'}),
				expect.objectContaining({source: ChatMessageSource.FAQ, message: '65 ans', sources: [{type: 'URL', link: 'https://ahv.ch/retraite'}]})
			]);
			expect(store.currentConversation().conversationId).toBe('srv');
			expect(store.searchCtrl.value).toBe('');
		});

		it('ajoute l’échange à la conversation courante', () => {
			completeTurn();

			store.selectOption({...faq, url: 'reglement.pdf'});

			expect(conversationService.update).toHaveBeenCalledWith(store.currentConversation().conversationId, [
				expect.objectContaining({source: ChatMessageSource.USER}),
				expect.objectContaining({source: ChatMessageSource.FAQ, sources: [{type: 'FILE', link: 'reglement.pdf'}]})
			]);
		});

		it('n’enregistre rien pour un utilisateur non inscrit', () => {
			user$.next(aUser({status: UserStatus.GUEST}));

			store.selectOption({...faq, url: undefined});

			expect(store.messages()[1].sources).toEqual([]);
			expect(conversationService.init).not.toHaveBeenCalled();
		});
	});

	describe('conversations', () => {
		it('repart d’une conversation vierge', () => {
			completeTurn();
			const focus = jest.fn();
			store.focusRequests.subscribe(focus);

			store.newChat();

			expect(store.currentConversation()).toBeNull();
			expect(store.messages()).toEqual([]);
			expect(focus).toHaveBeenCalled();
		});

		it('supprime une autre conversation sans quitter la conversation courante', () => {
			completeTurn();
			const current = store.currentConversation();

			store.deleteConversation({conversationId: 'autre', title: 'x', timestamp: new Date()});

			expect(store.currentConversation()).toBe(current);
			expect(store.messages()).toHaveLength(2);
		});

		it('renomme une conversation', () => {
			completeTurn();
			const conversationId = store.currentConversation().conversationId;

			store.renameConversation({conversationId, title: 'Nouveau titre'});

			expect(store.currentConversation().title).toBe('Nouveau titre');
		});

		it('repose une question dans le workspace choisi', () => {
			completeTurn();

			store.changeWorkspace({question: 'Bonjour', workspace: 'AI'});
			store.changeWorkspace({question: '', workspace: 'AI'});

			expect(ragService.process).toHaveBeenCalledTimes(2);
			expect(ragService.process).toHaveBeenLastCalledWith(expect.objectContaining({query: 'Bonjour', workspace: 'AI'}));
			expect(store.messages()).toHaveLength(4);
		});
	});

	describe('rejouer le dernier tour', () => {
		it('n’est possible que pour la dernière paire terminée', () => {
			ask('Bonjour');
			const [question] = store.messages();
			expect(store.isReplayable(question)).toBe(false);

			emit(...answerTurn('Salut'));
			expect(store.isReplayable(question)).toBe(true);
			expect(store.isReplayable(answer())).toBe(true);
		});

		it('ignore une question modifiée vide', () => {
			completeTurn();

			store.editLastQuestion('   ');

			expect(ragService.process).toHaveBeenCalledTimes(1);
		});

		it('ne fait rien sans tour rejouable', () => {
			store.regenerateLastAnswer();

			expect(ragService.process).not.toHaveBeenCalled();
		});
	});

	describe('suggestions et formulaire', () => {
		it('préremplit la saisie avec le préfixe de l’action', () => {
			jest.spyOn(TestBed.inject(ChatSuggestionService), 'handleSuggestionAction').mockReturnValue({shouldShowForm: false, searchValue: 'Résume : '});

			store.handleSuggestionAction('summary');

			expect(store.searchCtrl.value).toBe('Résume : ');
			expect(store.activeForm()).toBeUndefined();
		});

		it('ouvre le formulaire puis envoie le message hydraté', () => {
			const form = {def: {actionId: 'II_CALCUL'}, group: new FormGroup({})};
			jest.spyOn(TestBed.inject(ChatSuggestionService), 'handleSuggestionAction').mockReturnValue({
				shouldShowForm: true,
				formDef: form.def as never,
				formGroup: form.group
			});

			store.handleSuggestionAction('ii-salary');
			expect(store.activeForm()).toEqual(form);

			store.submitForm();

			expect(store.activeForm()).toBeUndefined();
			expect(ragService.process).toHaveBeenCalledWith(expect.objectContaining({query: 'Message hydraté'}));
		});

		it('ferme le formulaire', () => {
			jest.spyOn(TestBed.inject(ChatSuggestionService), 'handleSuggestionAction').mockReturnValue({
				shouldShowForm: true,
				formDef: {} as never,
				formGroup: new FormGroup({})
			});
			store.handleSuggestionAction('ii-salary');

			store.closeForm();

			expect(store.activeForm()).toBeUndefined();
		});

		it('n’applique rien sans préfixe', () => {
			jest.spyOn(TestBed.inject(ChatSuggestionService), 'handleSuggestionAction').mockReturnValue({shouldShowForm: false});

			store.handleSuggestionAction('inconnue');

			expect(store.searchCtrl.value).toBeNull();
		});
	});

	it('envoie un retour sur la réponse de la conversation courante', () => {
		completeTurn();

		store.sendFeedback({messageId: 'a1', isPositive: true});

		expect(feedbackService.sendAnswerFeedback).toHaveBeenCalledWith(
			expect.objectContaining({conversationId: store.currentConversation().conversationId, messageId: 'a1'})
		);
		expect(notif.success).toHaveBeenCalledWith('feedback.success');
	});

	describe('pièces jointes', () => {
		let attachments: ChatAttachmentsStore;

		beforeEach(() => {
			attachments = TestBed.inject(ChatAttachmentsStore);
		});

		it('rattache les fichiers à la conversation créée par le backend', () => {
			const upload = jest.spyOn(attachments, 'upload').mockImplementation((_, __, resolve) => resolve('srv-1'));

			store.addAttachments([new File(['x'], 'a.pdf')]);

			expect(upload).toHaveBeenCalledWith([expect.any(File)], null, expect.any(Function));
			expect(store.currentConversation()).toEqual(expect.objectContaining({conversationId: 'srv-1', provisional: true}));
		});

		it('délègue nouvel essai, suppression, téléchargement et rafraîchissement', () => {
			completeTurn();
			const conversation = store.currentConversation();
			const attachment = {id: 1, fileName: 'a.pdf'};
			const retry = jest.spyOn(attachments, 'retry').mockImplementation();
			const remove = jest.spyOn(attachments, 'remove').mockImplementation();
			const download = jest.spyOn(attachments, 'download').mockImplementation();
			const refresh = jest.spyOn(attachments, 'refresh').mockImplementation();

			store.retryAttachment(attachment);
			store.removeAttachment(1);
			store.downloadAttachment(attachment);
			store.refreshAttachmentsStatus();

			expect(retry).toHaveBeenCalledWith(attachment, conversation);
			expect(remove).toHaveBeenCalledWith(1);
			expect(download).toHaveBeenCalledWith(attachment, conversation.conversationId);
			expect(refresh).toHaveBeenCalledWith(conversation.conversationId);
		});
	});
});
