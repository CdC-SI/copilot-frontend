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
	/**
	 * Réponse enregistrée côté backend à remplacer pour rejouer ce tour, quand `id` n'est pas connu : réponse
	 * remplacée encore en base après l'échec d'une régénération, ou réponse arrêtée sans `done` (`generationId`).
	 */
	replaceableId?: string;
	/** Stop demandé au backend : en attente de `done {interrupted: true}`. */
	stopping?: boolean;
}

export enum ChatMessageSource {
	USER = 'USER',
	LLM = 'LLM',
	FAQ = 'FAQ'
}
