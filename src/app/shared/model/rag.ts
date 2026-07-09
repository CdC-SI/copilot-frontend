import {Language} from './answer';

export interface ChatRequest {
	query: string;
	attachments?: File[];
	language?: Language;
	tags?: string[];
	sources?: string[];
	llmModel?: string;
	topP?: number;
	temperature?: number;
	maxOutputTokens?: number;
	retrievalMethods?: string[];
	kRetrieve?: number;
	kMemory?: number;
	responseStyle?: string;
	responseFormat?: string;
	command?: string;
	commandArgs?: string;
	autocomplete?: boolean;
	rag?: boolean;
	agenticRag?: boolean;
	sourceValidation?: boolean;
	topicCheck?: boolean;
	isFollowUpQ?: boolean;
	conversationId?: string;
	/** Nom du workspace explicitement choisi par l'utilisateur (override du routing automatique). */
	workspace?: string;
}

export enum ChatRequestConfigFields {
	LANGUAGE = 'language',
	TAGS = 'tags',
	SOURCES = 'sources',
	RESPONSE_STYLE = 'responseStyle',
	RESPONSE_FORMAT = 'responseFormat'
}
