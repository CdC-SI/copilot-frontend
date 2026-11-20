import {Injectable, Signal, WritableSignal, signal} from '@angular/core';
import {v4 as uuidv4} from 'uuid';
import {ChatMessage, ChatMessageSource} from '../../shared/model/chat-message';
import {Language} from '../../shared/model/answer';
import {ChatHistoryMessage, MessageSource} from '../../shared/model/chat-history';
import {NEW_CHAT_KEY} from './chat.constants';

/**
 * Cache des messages par conversation (conservé entre deux navigations). Chaque conversation est un signal ;
 * les messages ne sont jamais modifiés en place : toute mise à jour remplace le message (identifié par `clientId`).
 */
@Injectable({
	providedIn: 'root'
})
export class ChatConversationManagerService {
	private readonly conversationMessages = new Map<string, WritableSignal<ChatMessage[]>>();

	/** Messages d'une conversation ; `null` : nouvelle conversation pas encore créée. */
	messages(conversationId: string | null): Signal<ChatMessage[]> {
		return this.entry(conversationId).asReadonly();
	}

	getMessages(conversationId: string | null): ChatMessage[] {
		return this.entry(conversationId)();
	}

	find(conversationId: string | null, clientId: string): ChatMessage | undefined {
		return this.getMessages(conversationId).find(message => message.clientId === clientId);
	}

	addMessage(
		conversationId: string | null,
		source: ChatMessageSource,
		message: string,
		inError = false,
		isCompleted = true,
		lang?: Language,
		faqItemId?: number,
		url?: string,
		sources?: MessageSource[]
	): ChatMessage {
		const chatMessage: ChatMessage = {
			clientId: uuidv4(),
			faqItemId,
			message,
			source,
			isCompleted,
			timestamp: new Date(),
			lang,
			url,
			inError,
			sources: sources || []
		};
		this.entry(conversationId).update(messages => [...messages, chatMessage]);
		return chatMessage;
	}

	/** Remplace le message `clientId` (sans effet s'il n'est plus dans la conversation). */
	replaceMessage(conversationId: string | null, clientId: string, next: ChatMessage): void {
		this.entry(conversationId).update(messages => messages.map(message => (message.clientId === clientId ? next : message)));
	}

	patchMessage(conversationId: string | null, clientId: string, changes: Partial<ChatMessage>): void {
		const current = this.find(conversationId, clientId);
		if (current) this.replaceMessage(conversationId, clientId, {...current, ...changes});
	}

	setConversationMessages(conversationId: string, messages: ChatMessage[]): void {
		this.entry(conversationId).set(messages);
	}

	clearConversation(conversationId: string): void {
		this.entry(conversationId).set([]);
	}

	deleteConversation(conversationId: string): void {
		this.conversationMessages.get(conversationId)?.set([]);
		this.conversationMessages.delete(conversationId);
	}

	initNewChat(): void {
		this.entry(null).set([]);
	}

	transferNewChatToConversation(conversationId: string): void {
		const newChatMessages = this.getMessages(null);
		if (newChatMessages.length > 0) {
			this.entry(conversationId).set(newChatMessages);
			this.entry(null).set([]);
		}
	}

	historyMessageToChatMessage(historyMessage: ChatHistoryMessage): ChatMessage {
		const isUserMessage = historyMessage.role.toUpperCase() === 'USER';
		return {
			clientId: uuidv4(),
			id: historyMessage.messageId,
			message: historyMessage.message,
			source: isUserMessage ? ChatMessageSource.USER : ChatMessageSource.LLM,
			isCompleted: true,
			timestamp: historyMessage.timestamp,
			lang: historyMessage.language,
			faqItemId: historyMessage.faqItemId,
			sources: historyMessage.sources,
			suggestions: historyMessage.suggestions,
			workspace: historyMessage.workspace,
			interrupted: historyMessage.interrupted
		};
	}

	private entry(conversationId: string | null): WritableSignal<ChatMessage[]> {
		const id = conversationId || NEW_CHAT_KEY;
		let messages = this.conversationMessages.get(id);
		if (!messages) {
			messages = signal<ChatMessage[]>([]);
			this.conversationMessages.set(id, messages);
		}
		return messages;
	}
}
