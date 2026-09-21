import {MessageSource} from './chat-history';

export type FeedbackStatus = 'NEW' | 'TREATED' | 'OBSOLETE';

export type FeedbackCategory = 'WRONG_SOURCE' | 'WRONG_ANSWER' | 'INCOMPLETE_ANSWER';

export const FEEDBACK_STATUSES: FeedbackStatus[] = ['NEW', 'TREATED', 'OBSOLETE'];

/** Categories selectable by the user when giving negative feedback on an LLM answer. */
export const ANSWER_FEEDBACK_CATEGORIES: FeedbackCategory[] = ['WRONG_ANSWER', 'INCOMPLETE_ANSWER'];

/** Categories selectable by the user when giving negative feedback on a source. */
export const SOURCE_FEEDBACK_CATEGORIES: FeedbackCategory[] = ['WRONG_SOURCE'];

export interface Feedback {
	messageId: string;
	isPositive: boolean;
	comment?: string;
	conversationId?: string;
	question?: string;
	answer?: string;
	category?: FeedbackCategory;
}

export interface SourceFeedback {
	conversationId: string;
	messageId: string;
	documentId: string;
	isPositive: boolean;
	comment?: string;
	question?: string;
	answer?: string;
	category?: FeedbackCategory;
}

export interface IMessageFeedback {
	id: number;
	userUuid: string;
	conversationUuid: string;
	messageUuid: string;
	score: 1 | -1; // 1 POSITIVE, -1 NEGATIVE
	comment?: string;
	timestamp: string; // ISO date
	status: FeedbackStatus;
	category?: FeedbackCategory;
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
	status: FeedbackStatus;
	category?: FeedbackCategory;
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
	statusCounts: Record<FeedbackStatus, number>;
	feedbacks: ISourceFeedback[];
}

/** Réglages de planification du rapport hebdomadaire des feedbacks. */
export interface FeedbackReportConfig {
	enabled: boolean;
	cronExpression: string;
	zoneId: string;
	recipients: string[];
	lookbackDays: number;
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
