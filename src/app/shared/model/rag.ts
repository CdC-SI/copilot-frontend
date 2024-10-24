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
	LLM_MODEL: ['Model 1', 'Model 2', 'Model 3'],
	TAGS: ['Tag 1', 'Tag 2', 'Tag 3'],
	SOURCES: ['Source 1', 'Source 2', 'Source 3'],
	RETRIEVAL_METHODS: ['Method 1', 'Method 2', 'Method 3'],
	STYLES: ['Style 1', 'Style 2', 'Style 3']
};
