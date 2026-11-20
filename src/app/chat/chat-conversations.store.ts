import {Injectable, computed, inject, signal} from '@angular/core';
import {v4 as uuidv4} from 'uuid';
import {ChatTitle} from '../shared/model/chat-history';
import {ConversationService} from '../shared/services/conversation.service';
import {ChatConversationManagerService} from './services';

/**
 * Historique des conversations (titres triés du plus récent au plus ancien) et conversation courante.
 * Les titres ne sont jamais modifiés en place : chaque changement produit une nouvelle liste.
 */
@Injectable()
export class ChatConversationsStore {
	readonly titles = computed(() => this.titleList());
	readonly current = computed(() => this.currentTitle());
	private readonly titleList = signal<ChatTitle[]>([]);
	private readonly currentTitle = signal<ChatTitle | null>(null);
	private readonly conversationService = inject(ConversationService);
	private readonly manager = inject(ChatConversationManagerService);

	loadTitles(): void {
		this.conversationService.getConversationTitles().subscribe(conversations => this.setSorted(conversations));
	}

	startNew(): void {
		this.markSelected(null);
		this.currentTitle.set(null);
	}

	markSelected(conversationId: string | null): void {
		this.titleList.update(titles =>
			titles.map(title => {
				const selected = title.conversationId === conversationId;
				return !!title.selected === selected ? title : {...title, selected};
			})
		);
	}

	open(chatTitle: ChatTitle): void {
		this.currentTitle.set(this.findTitle(chatTitle.conversationId) ?? chatTitle);
	}

	/** Retire une conversation de l'historique ; renvoie `true` si c'était la conversation courante. */
	remove(conversationId: string): boolean {
		this.titleList.update(titles => titles.filter(title => title.conversationId !== conversationId));
		if (this.currentTitle()?.conversationId !== conversationId) return false;
		this.currentTitle.set(null);
		return true;
	}

	rename(conversationId: string, title: string): void {
		this.titleList.update(titles => titles.map(t => (t.conversationId === conversationId ? {...t, title} : t)));
		const current = this.currentTitle();
		if (current?.conversationId === conversationId) this.currentTitle.set({...current, title});
	}

	/**
	 * Crée localement la conversation courante si elle n'existe pas encore : le front est propriétaire de son
	 * identifiant (ou réutilise celui fourni par le backend), ce qui permet de rattacher les questions suivantes
	 * sans attendre la génération du titre côté backend. Renvoie l'identifiant de la conversation courante.
	 */
	ensureCurrent(title: string, conversationId?: string): string {
		const current = this.currentTitle();
		if (current) return current.conversationId;
		const created: ChatTitle = {
			conversationId: conversationId ?? uuidv4(),
			title,
			timestamp: new Date(),
			selected: true,
			provisional: true
		};
		this.currentTitle.set(created);
		this.manager.transferNewChatToConversation(created.conversationId);
		return created.conversationId;
	}

	/** Affiche immédiatement une conversation provisoire dans la liste, avec la question comme titre temporaire. */
	listProvisional(question: string): void {
		const current = this.currentTitle();
		if (!current?.provisional || this.findTitle(current.conversationId)) return;
		const listed = {...current, title: question};
		this.currentTitle.set(listed);
		this.titleList.update(titles => [listed, ...titles]);
	}

	/** Fin d'un flux : le titre d'une conversation provisoire vient d'être généré par le backend. */
	refreshIfProvisional(conversationId: string): void {
		if (this.findTitle(conversationId)?.provisional) this.refresh();
	}

	/**
	 * Recharge les titres depuis le backend et resynchronise la conversation courante par son identifiant
	 * (titre provisoire remplacé par le titre généré). `selectNewest` est réservé au flux FAQ, où le backend
	 * génère l'id sans le renvoyer : la conversation la plus récente devient alors la conversation courante.
	 */
	refresh(selectNewest = false): void {
		this.conversationService.getConversationTitles().subscribe(conversations => {
			const serverIds = new Set(conversations.map(c => c.conversationId));
			// Les conversations provisoires pas encore connues du backend (titre en cours de génération) sont conservées.
			const pending = this.titleList().filter(c => c.provisional && !serverIds.has(c.conversationId));
			this.setSorted([...pending, ...conversations]);
			const newest = this.titleList().find(c => serverIds.has(c.conversationId));
			if (selectNewest && !this.currentTitle() && newest) {
				this.currentTitle.set(newest);
				this.manager.transferNewChatToConversation(newest.conversationId);
			}
			this.syncCurrent();
		});
	}

	private syncCurrent(): void {
		const conversationId = this.currentTitle()?.conversationId;
		if (!this.findTitle(conversationId)) return;
		this.markSelected(conversationId);
		this.currentTitle.set(this.findTitle(conversationId));
	}

	private findTitle(conversationId: string | undefined): ChatTitle | undefined {
		return this.titleList().find(title => title.conversationId === conversationId);
	}

	private setSorted(conversations: ChatTitle[]): void {
		this.titleList.set([...conversations].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
	}
}
