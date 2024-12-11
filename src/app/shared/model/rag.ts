import {Language} from './answer';

export interface ChatRequest {
	query: string;
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
	isFollowUpQ?: boolean;
	conversationId?: string;
}

export enum ChatRequestConfigFields {
	LANGUAGE = 'language',
	TAGS = 'tags',
	SOURCES = 'sources',
	LLM_MODEL = 'llmModel',
	TOP_P = 'topP',
	TEMPERATURE = 'temperature',
	MAX_OUTPUT_TOKENS = 'maxOutputTokens',
	RETRIEVAL_METHODS = 'retrievalMethods',
	K_RETRIEVE = 'kRetrieve',
	K_MEMORY = 'kMemory',
	RESPONSE_STYLE = 'responseStyle',
	RESPONSE_FORMAT = 'responseFormat',
	COMMAND = 'command',
	COMMAND_ARGS = 'commandArgs',
	AUTOCOMPLETE = 'autocomplete',
	RAG = 'rag',
	AGENTIC_RAG = 'agenticRag',
	IS_FOLLOWUP_Q = 'isFollowUpQ'
}
