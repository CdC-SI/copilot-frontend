import {Injectable} from '@angular/core';
import {ChatMessage, ChatMessageSource} from '../../shared/model/chat-message';
import {Language} from '../../shared/model/answer';
import {ChatHistoryMessage, MessageSource} from '../../shared/model/chat-history';
import {NEW_CHAT_KEY} from './chat.constants';

@Injectable({
	providedIn: 'root'
})
export class ChatConversationManagerService {
	private readonly conversationMessages: Map<string, ChatMessage[]> = new Map();
	private activeStreamingConversationId: string | null = null;

	getMessages(conversationId: string | null): ChatMessage[] {
		const id = conversationId || NEW_CHAT_KEY;
		if (!this.conversationMessages.has(id)) {
			this.conversationMessages.set(id, []);
		}
		return this.conversationMessages.get(id);
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
	): void {
		const id = this.activeStreamingConversationId || conversationId || NEW_CHAT_KEY;
		if (!this.conversationMessages.has(id)) {
			this.conversationMessages.set(id, []);
		}
		const messages = this.conversationMessages.get(id);
		messages.push({
			faqItemId,
			message,
			source,
			isCompleted,
			timestamp: new Date(),
			lang,
			url,
			inError,
			beingSpoken: false,
			sources: sources || []
		});
	}

	setActiveStreamingConversation(conversationId: string | null): void {
		this.activeStreamingConversationId = conversationId || NEW_CHAT_KEY;
	}

	clearActiveStreamingConversation(): void {
		this.activeStreamingConversationId = null;
	}

	getActiveStreamingConversationId(): string | null {
		return this.activeStreamingConversationId;
	}

	getStreamingMessages(): ChatMessage[] | undefined {
		if (!this.activeStreamingConversationId) return undefined;
		return this.conversationMessages.get(this.activeStreamingConversationId);
	}

	setConversationMessages(conversationId: string, messages: ChatMessage[]): void {
		this.conversationMessages.set(conversationId, messages);
	}

	clearConversation(conversationId: string): void {
		this.conversationMessages.set(conversationId, []);
	}

	deleteConversation(conversationId: string): void {
		this.conversationMessages.delete(conversationId);
	}

	initNewChat(): void {
		this.conversationMessages.set(NEW_CHAT_KEY, []);
	}

	transferNewChatToConversation(conversationId: string): void {
		const newChatMessages = this.conversationMessages.get(NEW_CHAT_KEY);
		if (newChatMessages && newChatMessages.length > 0) {
			this.conversationMessages.set(conversationId, newChatMessages);
			this.conversationMessages.delete(NEW_CHAT_KEY);
		}
	}

	historyMessageToChatMessage(historyMessage: ChatHistoryMessage): ChatMessage {
		const isUserMessage = historyMessage.role.toUpperCase() === 'USER';
		return {
			id: historyMessage.messageId,
			message: historyMessage.message,
			source: isUserMessage ? ChatMessageSource.USER : ChatMessageSource.LLM,
			isCompleted: true,
			timestamp: historyMessage.timestamp,
			lang: historyMessage.language,
			faqItemId: historyMessage.faqItemId,
			sources: historyMessage.sources,
			suggestions: historyMessage.suggestions
		};
	}
}
