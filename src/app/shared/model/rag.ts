import {Language} from './answer';

/** Champs envoyés à `POST /conversations` (record `Question` côté backend). */
export interface ChatRequest {
	query: string;
	language?: Language;
	conversationId?: string;
	/** Nom du workspace explicitement choisi par l'utilisateur (override du routing automatique). */
	workspace?: string;
	/** Si false, la question est traitée en mode "LLM seul" : aucune recherche n'est faite dans le Corpus documentaire. */
	ragEnabled?: boolean;
}
