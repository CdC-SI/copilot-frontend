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
}

export enum ChatMessageSource {
	USER = 'USER',
	LLM = 'LLM',
	FAQ = 'FAQ'
}
