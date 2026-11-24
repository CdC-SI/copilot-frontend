import {TestBed} from '@angular/core/testing';
import {of} from 'rxjs';
import {ChatTitle} from '../shared/model/chat-history';
import {ChatMessageSource} from '../shared/model/chat-message';
import {ConversationService} from '../shared/services/conversation.service';
import {aChatTitle} from '../../testing/fixtures';
import {ChatConversationsStore} from './chat-conversations.store';
import {ChatConversationManagerService} from './services';

describe('ChatConversationsStore', () => {
	let store: ChatConversationsStore;
	let manager: ChatConversationManagerService;
	let getTitles: jest.Mock;

	const older = aChatTitle({conversationId: 'old', title: 'Ancienne', timestamp: new Date('2026-01-01T10:00:00Z')});
	const newer = aChatTitle({conversationId: 'new', title: 'Récente', timestamp: new Date('2026-02-01T10:00:00Z')});
	const ids = () => store.titles().map(title => title.conversationId);

	beforeEach(() => {
		getTitles = jest.fn(() => of([older, newer]));
		TestBed.configureTestingModule({providers: [ChatConversationsStore, {provide: ConversationService, useValue: {getConversationTitles: getTitles}}]});
		store = TestBed.inject(ChatConversationsStore);
		manager = TestBed.inject(ChatConversationManagerService);
		manager.initNewChat();
	});

	it('trie les titres du plus récent au plus ancien', () => {
		store.loadTitles();

		expect(ids()).toEqual(['new', 'old']);
	});

	it('ouvre une conversation connue avec son titre de la liste, ou celle fournie', () => {
		store.loadTitles();

		store.open(aChatTitle({conversationId: 'old', title: 'Autre titre'}));
		expect(store.current().title).toBe('Ancienne');

		const unknown = aChatTitle({conversationId: 'x'});
		store.open(unknown);
		expect(store.current()).toBe(unknown);
	});

	it('sélectionne une conversation sans recréer les titres inchangés', () => {
		store.loadTitles();
		const before = store.titles();

		store.markSelected('old');

		expect(store.titles()[0]).toBe(before[0]);
		expect(store.titles()[1].selected).toBe(true);

		store.startNew();
		expect(store.titles().some(title => title.selected)).toBe(false);
		expect(store.current()).toBeNull();
	});

	it('signale la suppression de la conversation courante', () => {
		store.loadTitles();
		store.open(newer);

		expect(store.remove('old')).toBe(false);
		expect(store.current()).not.toBeNull();
		expect(store.remove('new')).toBe(true);
		expect(store.current()).toBeNull();
		expect(ids()).toEqual([]);
	});

	it('renomme dans la liste et la conversation courante', () => {
		store.loadTitles();
		store.open(newer);

		store.rename('new', 'Renommée');
		store.rename('old', 'Aussi');

		expect(store.titles().map(title => title.title)).toEqual(['Renommée', 'Aussi']);
		expect(store.current().title).toBe('Renommée');
	});

	describe('conversation provisoire', () => {
		it('est créée une seule fois, avec les messages saisis avant sa création', () => {
			manager.addMessage(null, ChatMessageSource.USER, 'Question');

			const id = store.ensureCurrent('Question');

			expect(store.current()).toEqual(expect.objectContaining({conversationId: id, provisional: true, selected: true}));
			expect(manager.getMessages(id).map(message => message.message)).toEqual(['Question']);
			expect(store.ensureCurrent('Autre')).toBe(id);
		});

		it('reprend l’identifiant fourni par le backend', () => {
			expect(store.ensureCurrent('Pièces jointes', 'srv-1')).toBe('srv-1');
		});

		it('est listée une fois, avec la question pour titre', () => {
			store.loadTitles();
			store.ensureCurrent('…');

			store.listProvisional('Ma question');
			store.listProvisional('Ma question');

			expect(store.titles()[0]).toEqual(expect.objectContaining({title: 'Ma question', provisional: true}));
			expect(store.titles()).toHaveLength(3);
		});

		it('n’est pas listée pour une conversation déjà enregistrée', () => {
			store.loadTitles();
			store.open(newer);

			store.listProvisional('Question');

			expect(store.titles()).toHaveLength(2);
		});

		it('prend le titre généré par le backend à la fin du flux', () => {
			const id = store.ensureCurrent('Question');
			store.listProvisional('Question');
			getTitles.mockReturnValue(of([aChatTitle({conversationId: id, title: 'Titre généré', timestamp: new Date('2026-03-01T10:00:00Z')}), older]));

			store.refreshIfProvisional(id);

			expect(store.current()).toEqual(expect.objectContaining({conversationId: id, title: 'Titre généré', selected: true}));
			expect(store.current().provisional).toBeUndefined();
			expect(ids()).toEqual([id, 'old']);
		});

		it('reste listée tant que le backend ne la connaît pas', () => {
			const id = store.ensureCurrent('Question');
			store.listProvisional('Question');

			store.refresh();

			expect(ids()).toContain(id);
			expect(store.current().provisional).toBe(true);
		});
	});

	it('ne recharge pas les titres pour une conversation déjà enregistrée', () => {
		store.loadTitles();
		getTitles.mockClear();

		store.refreshIfProvisional('old');

		expect(getTitles).not.toHaveBeenCalled();
	});

	it('FAQ : sélectionne la conversation la plus récente créée par le backend', () => {
		manager.addMessage(null, ChatMessageSource.USER, 'Question FAQ');

		store.refresh(true);

		expect(store.current()).toEqual(expect.objectContaining({conversationId: 'new', selected: true}));
		expect(manager.getMessages('new').map(message => message.message)).toEqual(['Question FAQ']);
	});

	it('FAQ : garde la conversation courante', () => {
		const current: ChatTitle = aChatTitle({conversationId: 'old'});
		store.open(current);

		store.refresh(true);

		expect(store.current().conversationId).toBe('old');
	});
});
