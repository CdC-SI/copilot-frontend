export interface ChatMessage {
	faqItemId?: number;
	message?: string;
	source: ChatMessageSource;
	timestamp: Date;
	url?: string;
	beingSpoken?: boolean;
	lang?: string;
}

export enum ChatMessageSource {
	USER = 'USER',
	LLM = 'LLM',
	FAQ = 'FAQ'
}
