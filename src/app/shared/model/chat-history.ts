/**
 * Type de conversation renvoyé par le backend :
 * - COMPLETE : conversation standard, l'assistant peut rechercher dans le Corpus documentaire.
 * - NO_RAG   : conversation "sans Corpus", l'assistant répond uniquement en mode LLM (+ pièces jointes).
 * Ce type est figé à la création de la conversation et reste valable pour tous les échanges qui suivent.
 */
export enum ConversationType {
	COMPLETE = 'COMPLETE',
	NO_RAG = 'NO_RAG'
}

export interface ChatTitle {
	title: string;
	conversationId: string;
	timestamp: Date;
	selected?: boolean;
	type?: ConversationType;
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
	workspace?: string;
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

export type AttachmentStatus = 'PENDING' | 'PROCESSED' | 'FAILED';

export interface Attachment {
	id?: number;
	fileName?: string;
	fileSize?: number;
	file?: File;
	isUploading?: boolean;
	status?: AttachmentStatus;
}

export interface AttachmentDTO {
	id: number;
	filename: string;
	fileSize: number;
	status: AttachmentStatus;
}

export interface ConversationAttachments {
	conversationId: string;
	attachments: AttachmentDTO[];
}

export interface AttachmentUploadResponse {
	status: AttachmentStatus;
	message: string;
	conversationAttachments: ConversationAttachments;
}
