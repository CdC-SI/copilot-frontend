import {Language} from './answer';

export interface ChatRequest {
	query: string;
	language?: Language;
	tag?: string[];
	source?: string[];
	llm_model?: string;
	retrieval_method?: string[];
	k_memory?: number;
	response_style?: string;
	autocomplete?: boolean;
	rag?: boolean;
	user_uuid?: string;
	conversation_uuid?: string;
}

export enum ChatRequestConfigFields {
	QUERY = 'query',
	LANGUAGE = 'language',
	TAG = 'tag',
	SOURCE = 'source',
	LLM_MODEL = 'llm_model',
	RETRIEVAL_METHOD = 'retrieval_method',
	K_MEMORY = 'k_memory',
	RESPONSE_STYLE = 'response_style',
	AUTOCOMPLETE = 'autocomplete',
	RAG = 'rag',
	USER_UUID = 'user_uuid',
	CONVERSATION_UUID = 'conversation_uuid'
}


// Mock lists from backend
export const CHAT_REQUEST_FORM_OPTIONS = {
	LLM_MODEL: ['Model 1', 'Model 2', 'Model 3'],
	TAGS: ['Tag 1', 'Tag 2', 'Tag 3'],
	SOURCES: ['Source 1', 'Source 2', 'Source 3'],
	RETRIEVAL_METHODS: ['Method 1', 'Method 2', 'Method 3'],
	STYLES: ['Style 1', 'Style 2', 'Style 3']
};
