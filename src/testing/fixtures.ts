import type {ChatHistoryMessage, ChatTitle, Conversation} from '../app/shared/model/chat-history';
import type {IUser} from '../app/shared/model/user';

/**
 * Données de test du domaine (utilisateur, conversations), partagées par Jest et Playwright.
 * Pas d'import de valeurs Angular ni d'enums : uniquement des types (`import type`).
 */

/** Utilisateur actif (inscrit) avec le rôle USER ; surcharger `roles` pour un expert ou un administrateur. */
export function aUser(user: Partial<IUser> = {}): IUser {
	return {username: 'u12345', firstName: 'Ada', lastName: 'Lovelace', status: 'ACTIVE', roles: ['USER'], internalUser: true, ...user} as IUser;
}

export function aChatTitle(title: Partial<ChatTitle> = {}): ChatTitle {
	return {conversationId: 'c1', title: 'Rente de vieillesse', timestamp: new Date('2026-01-15T10:00:00Z'), ...title};
}

export function aHistoryMessage(message: Partial<ChatHistoryMessage> = {}): ChatHistoryMessage {
	return {
		messageId: 'm1',
		conversationId: 'c1',
		message: 'Bonjour',
		role: 'USER',
		timestamp: new Date('2026-01-15T10:00:00Z'),
		language: 'fr',
		...message
	};
}

/** Conversation enregistrée : une question puis sa réponse. */
export function aConversation(conversationId = 'c1', question = 'Quel est l’âge de la retraite ?', answer = 'L’âge de référence est de 65 ans.'): Conversation {
	return {
		conversationId,
		messages: [
			aHistoryMessage({messageId: `${conversationId}-q`, conversationId, message: question, role: 'USER'}),
			aHistoryMessage({messageId: `${conversationId}-a`, conversationId, message: answer, role: 'LLM'})
		],
		attachments: []
	};
}
