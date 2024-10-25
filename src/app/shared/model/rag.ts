import {Language} from './answer';

export interface ChatRequest {
	query: string;
	language?: Language;
	tags?: string[];
	sources?: string[];
	llmModel?: string;
	retrievalMethods?: string[];
	kMemory?: number;
	responseStyle?: string;
	autocomplete?: boolean;
	rag?: boolean;
	conversationId?: string;
}

export enum ChatRequestConfigFields {
	LANGUAGE = 'language',
	TAGS = 'tags',
	SOURCES = 'sources',
	LLM_MODEL = 'llmModel',
	RETRIEVAL_METHODS = 'retrievalMethods',
	K_MEMORY = 'kMemory',
	RESPONSE_STYLE = 'responseStyle',
	AUTOCOMPLETE = 'autocomplete',
	RAG = 'rag'
}

// Mock lists from backend
export const CHAT_REQUEST_FORM_OPTIONS = {
	STYLES: ['concise', 'detailed', 'formal', 'legal']
};
