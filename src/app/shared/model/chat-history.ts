import {UploadErrorCode} from './upload-error';

export interface ChatTitle {
	title: string;
	conversationId: string;
	timestamp: Date;
	selected?: boolean;
	/** Conversation créée localement dont le titre n'a pas encore été généré par le backend. */
	provisional?: boolean;
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
	faqItemId?: string;
	sources?: MessageSource[];
	suggestions?: string[];
	workspace?: string;
	/** Réponse partielle enregistrée après l'arrêt de la génération. */
	interrupted?: boolean;
}

export interface MessageSource {
	/** 'URL' | 'FILE' | 'BUSINESS_PROCESS' */
	type: string;
	link: string;
	/** Titre affiché (processus métier : nom du processus). */
	title?: string;
	pageNumber?: string;
	subsection?: string;
	version?: string;
	documentId?: string;
	questionId?: string;
	answerId?: string;
	/** Numéro de citation dans la réponse (`[^n]`, F2a) ; absent si la source n'est pas citée. */
	citation?: number;
}

export type AttachmentStatus = 'PENDING' | 'PROCESSED' | 'FAILED';

export interface Attachment {
	id?: number;
	fileName?: string;
	fileSize?: number;
	file?: File;
	isUploading?: boolean;
	status?: AttachmentStatus;
	/** Cause de l'échec, renseignée uniquement si status === 'FAILED'. */
	errorCode?: UploadErrorCode;
}

export interface AttachmentDTO {
	id: number;
	filename: string;
	fileSize: number;
	status: AttachmentStatus;
	errorCode?: UploadErrorCode;
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
