export interface ChatTitle {
	title: string;
	conversationId: string;
	timestamp: Date;
	selected?: boolean;
}

export interface ChatHistoryMessage {
	messageId: string;
	conversationId: string;
	message: string;
	role: string;
	timestamp: Date;
	language: string;
	url?: string;
	faqItemId?: number;
}
