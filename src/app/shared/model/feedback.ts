import {MessageSource} from './chat-history';

export interface Feedback {
	messageId: string;
	isPositive: boolean;
	comment?: string;
	conversationId?: string;
	question?: string;
	answer?: string;
}

export interface SourceFeedback {
	conversationId: string;
	messageId: string;
	documentId: string;
	isPositive: boolean;
	comment?: string;
	question?: string;
	answer?: string;
}

export interface IMessageFeedback {
	id: number;
	userUuid: string;
	conversationUuid: string;
	messageUuid: string;
	score: 1 | -1; // 1 POSITIVE, -1 NEGATIVE
	comment?: string;
	timestamp: string; // ISO date
	// Denormalized for the detail dialog (mocked for now)
	question?: string;
	answer?: string;
	sources?: MessageSource[];
}

export interface ISourceFeedback {
	id: number;
	userUuid: string;
	conversationUuid: string;
	messageUuid: string;
	documentId: string;
	feedbackType: 'POSITIVE' | 'NEGATIVE';
	comment?: string;
	timestamp: string; // ISO date
	// Optional denormalized
	documentTitle?: string;
	documentUrl?: string;
	question?: string;
	answer?: string;
}

export interface IDocumentFeedbackDetail {
	documentId: string;
	documentTitle?: string;
	documentUrl?: string;
	pos: number;
	neg: number;
	feedbacks: ISourceFeedback[];
}

export interface IFeedbackStats {
	total: number;
	positive: number;
	negative: number;
	positiveRate: number; // 0..1
	// time series at day granularity
	perDay: {date: string; positive: number; negative: number}[];
	// Top documents flagged (negatives first), include positives for context
	byDocument: {documentId: string; title: string; negatives: number; positives: number}[];
}
