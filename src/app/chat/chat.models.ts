import {ChatMessage} from '../shared/model/chat-message';

/** Défilement demandé à la timeline : dernière question, haut de la liste, ou visibilité du bouton « dernière question ». */
/** `last-user` : question envoyée (le tour est épinglé en haut du fil) ; `opened` : conversation chargée depuis l'historique. */
export type ChatScrollRequest = 'last-user' | 'opened' | 'reset' | 'visibility';

/** Dernier échange question/réponse de la conversation. */
export interface ChatTurn {
	question: ChatMessage;
	answer: ChatMessage;
}

/** Options d'une génération : workspace imposé, réponse remplacée (régénération) et restauration en cas de refus. */
export interface StreamOptions {
	workspace?: string;
	replaceMessageId?: string;
	restore?: () => void;
}
