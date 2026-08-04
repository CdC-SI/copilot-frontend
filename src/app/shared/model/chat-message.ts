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
	isRetrieving?: boolean;
	isValidating?: boolean;
	isRouting?: boolean;
	isAgent?: boolean;
	sources?: MessageSource[];
	suggestions?: string[];
	isToolUse?: boolean;
	isProcessingIntent?: boolean;
	isProcessingSources?: boolean;
	isProcessingTags?: boolean;
	/** Nom du workspace utilisé par le backend pour répondre à cette question (affiché au niveau de la question). */
	workspace?: string;
}

export enum ChatMessageSource {
	USER = 'USER',
	LLM = 'LLM',
	FAQ = 'FAQ'
}
