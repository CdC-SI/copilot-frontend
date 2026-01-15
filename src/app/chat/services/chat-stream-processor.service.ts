import {Injectable} from '@angular/core';
import {
	AGENT_TAG_REGEX,
	ANCHOR_TAG_REGEX,
	II_TARIFFS_ANSWER_TAG_REGEX,
	II_TARIFFS_TAG_REGEX,
	INTENT_TAG_REGEX,
	MESSAGE_ID_REGEX,
	OCR_TAG_REGEX,
	OFF_TOPIC_REGEX,
	RETRIEVING_TAG_REGEX,
	ROUTING_TAG_REGEX,
	SOURCE_TAG_REGEX,
	SUGGESTION_TAG_REGEX,
	TAGS_TAG_REGEX,
	TOOL_TAG_REGEX,
	TOPIC_CHECK_REGEX
} from '../../shared/utils/zco-utils';
import {ChatMessage} from '../../shared/model/chat-message';
import {MessageSource} from '../../shared/model/chat-history';

interface ProcessingState {
	isRetrieving?: boolean;
	isValidating?: boolean;
	isRouting?: boolean;
	isAgent?: boolean;
	isToolUse?: boolean;
	isProcessingIntent?: boolean;
	isProcessingSources?: boolean;
	isProcessingTags?: boolean;
}

interface StreamProcessingResult {
	shouldEnableSearch: boolean;
	shouldRefreshConversations: boolean;
	hasNewSuggestion: boolean;
	newSuggestion?: string;
}

@Injectable({
	providedIn: 'root'
})
export class ChatStreamProcessorService {
	processChunk(chunk: string, message: ChatMessage): StreamProcessingResult {
		const result: StreamProcessingResult = {
			shouldEnableSearch: false,
			shouldRefreshConversations: false,
			hasNewSuggestion: false
		};

		if (!chunk) return result;

		// Process status tags
		if (this.processStatusTag(chunk, message, TOOL_TAG_REGEX, {isToolUse: true})) return result;
		if (this.processStatusTag(chunk, message, INTENT_TAG_REGEX, {isProcessingIntent: true})) return result;
		if (this.processStatusTag(chunk, message, SOURCE_TAG_REGEX, {isProcessingSources: true})) return result;
		if (this.processStatusTag(chunk, message, TAGS_TAG_REGEX, {isProcessingTags: true})) return result;
		if (this.processStatusTag(chunk, message, AGENT_TAG_REGEX, {isAgent: true})) return result;
		if (this.processStatusTag(chunk, message, ROUTING_TAG_REGEX, {isRouting: true})) return result;
		if (this.processStatusTag(chunk, message, TOPIC_CHECK_REGEX, {isValidating: true})) return result;
		if (this.processStatusTag(chunk, message, RETRIEVING_TAG_REGEX, {isRetrieving: true})) return result;
		if (this.processStatusTag(chunk, message, OCR_TAG_REGEX, {isRetrieving: true})) return result;
		if (this.processStatusTag(chunk, message, II_TARIFFS_TAG_REGEX, {isRetrieving: true})) return result;
		if (this.processStatusTag(chunk, message, II_TARIFFS_ANSWER_TAG_REGEX, {isRetrieving: true})) return result;

		// Handle off-topic (clears validation)
		const offTopicMatch = OFF_TOPIC_REGEX.exec(chunk);
		if (offTopicMatch) {
			message.isValidating = false;
			return result;
		}

		// Clear processing states if transitioning to content
		if (this.isInProcessingState(message)) {
			this.clearProcessingStates(message);
			message.message = '';
		}

		// Append content
		message.message += chunk;

		// Initialize sources array if needed
		if (!message.sources) {
			message.sources = [];
		}

		// Extract and remove source tags
		this.extractSources(message);

		// Extract and remove suggestion tags
		const suggestionMatch = SUGGESTION_TAG_REGEX.exec(message.message);
		if (suggestionMatch) {
			message.message = message.message.replace(SUGGESTION_TAG_REGEX, '');
			result.hasNewSuggestion = true;
			result.newSuggestion = suggestionMatch[1];
		}

		// Extract and remove message ID tag
		const messageIdTagMatch = MESSAGE_ID_REGEX.exec(message.message);
		if (messageIdTagMatch) {
			message.message = message.message.replace(MESSAGE_ID_REGEX, '');
			message.id = messageIdTagMatch[1];
			message.isCompleted = true;
			result.shouldEnableSearch = true;
			result.shouldRefreshConversations = true;
		}

		return result;
	}

	private processStatusTag(chunk: string, message: ChatMessage, regex: RegExp, state: ProcessingState): boolean {
		const match = regex.exec(chunk);
		if (match) {
			message.message = match[1];
			Object.assign(message, state);
			return true;
		}
		return false;
	}

	private isInProcessingState(message: ChatMessage): boolean {
		return !!(
			message.isRetrieving ||
			message.isValidating ||
			message.isRouting ||
			message.isAgent ||
			message.isToolUse ||
			message.isProcessingIntent ||
			message.isProcessingSources ||
			message.isProcessingTags
		);
	}

	private clearProcessingStates(message: ChatMessage): void {
		message.isRetrieving = false;
		message.isValidating = false;
		message.isRouting = false;
		message.isAgent = false;
		message.isToolUse = false;
		message.isProcessingIntent = false;
		message.isProcessingSources = false;
		message.isProcessingTags = false;
	}

	private extractSources(message: ChatMessage): void {
		let sourceMatch;
		while ((sourceMatch = ANCHOR_TAG_REGEX.exec(message.message)) !== null) {
			const docId = sourceMatch[1];
			const sourceUrl = sourceMatch[2];
			const sourceFile = sourceMatch[3];
			const pageNumber = sourceMatch[4];
			const subSection = sourceMatch[5];
			const version = sourceMatch[6];

			const source: MessageSource = sourceUrl
				? {documentId: docId, type: 'URL', link: sourceUrl, pageNumber, subsection: subSection, version}
				: {documentId: docId, type: 'FILE', link: sourceFile, pageNumber, subsection: subSection, version};

			message.sources.push(source);
			message.message = message.message.replace(sourceMatch[0], '');
		}
	}
}
