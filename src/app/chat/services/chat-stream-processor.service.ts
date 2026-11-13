import {Injectable} from '@angular/core';
import {
	AGENT_TAG_REGEX,
	ANCHOR_TAG_REGEX,
	ATTACHMENT_TAG_REGEX,
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
	TOPIC_CHECK_REGEX,
	WORKSPACE_TAG_REGEX
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

/** Balises de statut (affichées à la place du contenu tant que la réponse n'a pas commencé), par ordre de priorité. */
const STATUS_TAGS: [RegExp, ProcessingState][] = [
	[RETRIEVING_TAG_REGEX, {isRetrieving: true}],
	[OCR_TAG_REGEX, {isRetrieving: true}],
	[ATTACHMENT_TAG_REGEX, {isRetrieving: true}],
	[TOOL_TAG_REGEX, {isToolUse: true}],
	[INTENT_TAG_REGEX, {isProcessingIntent: true}],
	[SOURCE_TAG_REGEX, {isProcessingSources: true}],
	[TAGS_TAG_REGEX, {isProcessingTags: true}],
	[AGENT_TAG_REGEX, {isAgent: true}],
	[ROUTING_TAG_REGEX, {isRouting: true}],
	[TOPIC_CHECK_REGEX, {isValidating: true}],
	[II_TARIFFS_TAG_REGEX, {isRetrieving: true}],
	[II_TARIFFS_ANSWER_TAG_REGEX, {isRetrieving: true}]
];

interface StreamProcessingResult {
	shouldEnableSearch: boolean;
	newSuggestions: string[];
}

@Injectable({
	providedIn: 'root'
})
export class ChatStreamProcessorService {
	processChunk(chunk: string, message: ChatMessage): StreamProcessingResult {
		const result: StreamProcessingResult = {shouldEnableSearch: false, newSuggestions: []};
		if (!chunk) return result;

		if (STATUS_TAGS.some(([regex, state]) => this.processStatusTag(chunk, message, regex, state))) return result;

		// Handle off-topic (clears validation)
		if (OFF_TOPIC_REGEX.test(chunk)) {
			message.isValidating = false;
			return result;
		}

		// Clear processing states if transitioning to content
		if (this.isInProcessingState(message)) {
			this.clearProcessingStates(message);
			message.message = '';
		}

		message.message += chunk;
		message.sources ??= [];

		// Une balise ne peut se compléter que dans le chunk qui apporte son > final :
		// inutile de re-scanner tout le message pour les autres chunks.
		if (chunk.includes('>')) {
			this.extractTags(message, result);
		}

		return result;
	}

	/** Arrêt de la génération : la réponse partielle est conservée, les états de traitement effacés. */
	interrupt(message: ChatMessage): void {
		if (this.isInProcessingState(message)) {
			this.clearProcessingStates(message);
			message.message = '';
		}
		message.isCompleted = true;
		message.interrupted = true;
	}

	private extractTags(message: ChatMessage, result: StreamProcessingResult): void {
		this.extractSources(message);
		this.extractWorkspace(message);

		let suggestionMatch: RegExpExecArray | null;
		while ((suggestionMatch = SUGGESTION_TAG_REGEX.exec(message.message)) !== null) {
			message.message = message.message.replace(suggestionMatch[0], '');
			if (suggestionMatch[1]) {
				result.newSuggestions.push(suggestionMatch[1]);
			}
		}

		const messageIdTagMatch = MESSAGE_ID_REGEX.exec(message.message);
		if (messageIdTagMatch) {
			message.message = message.message.replace(messageIdTagMatch[0], '');
			message.id = messageIdTagMatch[1];
			message.isCompleted = true;
			result.shouldEnableSearch = true;
		}
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
		let sourceMatch: RegExpExecArray | null;
		while ((sourceMatch = ANCHOR_TAG_REGEX.exec(message.message)) !== null) {
			const docId = sourceMatch[1];
			const sourceUrl = sourceMatch[2];
			const sourceFile = sourceMatch[3];
			const pageNumber = sourceMatch[4];
			const subSection = sourceMatch[5];
			const version = sourceMatch[6];
			const type = sourceMatch[7];
			const title = sourceMatch[8];

			let source: MessageSource;
			if (type === 'BUSINESS_PROCESS') {
				source = {documentId: docId, type: 'BUSINESS_PROCESS', link: sourceUrl, title, version};
			} else if (sourceUrl) {
				source = {documentId: docId, type: 'URL', link: sourceUrl, pageNumber, subsection: subSection, version};
			} else {
				source = {documentId: docId, type: 'FILE', link: sourceFile, pageNumber, subsection: subSection, version};
			}

			message.sources.push(source);
			message.message = message.message.replace(sourceMatch[0], '');
		}
	}

	private extractWorkspace(message: ChatMessage): void {
		const workspaceMatch = WORKSPACE_TAG_REGEX.exec(message.message);
		if (workspaceMatch) {
			message.workspace = workspaceMatch[1];
			message.message = message.message.replace(workspaceMatch[0], '');
		}
	}
}
