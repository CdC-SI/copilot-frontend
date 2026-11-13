import {MessageSource} from './chat-history';

export interface ChatMessage {
	id?: string;
	faqItemId?: number;
	message?: string;
	source: ChatMessageSource;
	timestamp: Date;
	url?: string;
	beingSpoken?: boolean;
	isCompleted?: boolean;
	lang?: string;
	inError?: boolean;
	/** Étape en cours (code de `status`), affichée à la place du contenu tant que la réponse n'a pas commencé. */
	status?: string;
	sources?: MessageSource[];
	suggestions?: string[];
	/** Identifiant annoncé par `start` pour la réponse en cours de génération ; `id` n'est posé qu'à `done`. */
	generationId?: string;
	/** Nom du workspace utilisé par le backend pour répondre à cette question (affiché au niveau de la question). */
	workspace?: string;
	/** Génération arrêtée avant la fin (bouton Stop ou changement de conversation) : réponse partielle. */
	interrupted?: boolean;
	/** L'échange correspondant a été enregistré côté backend, même si la réponse affichée est en erreur. */
	hasSavedExchange?: boolean;
}

export enum ChatMessageSource {
	USER = 'USER',
	LLM = 'LLM',
	FAQ = 'FAQ'
}
