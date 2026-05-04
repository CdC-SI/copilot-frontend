export interface ChatTitle {
	title: string;
	conversationId: string;
	timestamp: Date;
	selected?: boolean;
	workspace?: string;
}

export interface Conversation {
	conversationId?: string;
	userId?: string;
	messages: ChatHistoryMessage[];
	attachments: AttachmentDTO[];
}

export interface ChatHistoryMessage {
	messageId: string;
	conversationId: string;
	message: string;
	role: string;
	timestamp: Date;
	language: string;
	faqItemId?: number;
	sources?: MessageSource[];
	suggestions?: string[];
}

export interface MessageSource {
	type: string;
	link: string;
	pageNumber?: string;
	subsection?: string;
	version?: string;
	documentId?: string;
	questionId?: string;
	answerId?: string;
}

export interface Attachment {
	id?: number;
	fileName?: string;
	fileSize?: number;
	file?: File;
	isUploading?: boolean;
}

export interface AttachmentDTO {
	id: number;
	filename: string;
	fileSize: number;
}

export interface ConversationAttachments {
	conversationId: string;
	attachments: AttachmentDTO[];
}

export interface AttachmentUploadResponse {
	success: boolean;
	message: string;
	conversationAttachments: ConversationAttachments;
}
