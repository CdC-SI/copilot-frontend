export interface Feedback {
	messageId: string;
	isPositive: boolean;
	comment?: string;
	conversationId?: string;
}

export interface SourceFeedback {
	conversationId: string;
	messageId: string;
	documentId: string;
	isPositive: boolean;
	comment?: string;
}
