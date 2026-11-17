import {Injectable} from '@angular/core';
import {ChatMessage} from '../../shared/model/chat-message';
import {ChatStreamEvent} from '../../shared/model/chat-stream-event';

export interface StreamProcessingResult {
	/** `done` reçu : la réponse est terminée et enregistrée côté backend. */
	completed: boolean;
	/** `error` reçu : la génération a échoué, rien n'a été enregistré. */
	failed: boolean;
	newSuggestions: string[];
}

/** Applique les événements typés du flux de réponse (T1) au message de l'assistant. */
@Injectable({
	providedIn: 'root'
})
export class ChatStreamProcessorService {
	processEvent(event: ChatStreamEvent, message: ChatMessage): StreamProcessingResult {
		const result: StreamProcessingResult = {completed: false, failed: false, newSuggestions: []};
		switch (event.type) {
			case 'start':
				message.generationId = event.data.messageId;
				break;
			case 'status':
				this.showStatus(message, event.data.code, event.data.label);
				break;
			case 'text_delta':
				this.clearStatus(message);
				message.message = (message.message ?? '') + event.data.text;
				break;
			case 'source':
				(message.sources ??= []).push(event.data);
				break;
			case 'suggestion':
				result.newSuggestions.push(event.data.text);
				break;
			case 'workspace':
				message.workspace = event.data.name;
				break;
			case 'done':
				this.complete(message, event.data.messageId, event.data.interrupted);
				result.completed = true;
				break;
			case 'error':
				this.clearStatus(message);
				result.failed = true;
				break;
		}
		return result;
	}

	/** Arrêt de la génération : la réponse partielle est conservée, le statut effacé. */
	interrupt(message: ChatMessage): void {
		this.clearStatus(message);
		message.stopping = undefined;
		message.isCompleted = true;
		message.interrupted = true;
	}

	/** Le statut s'affiche à la place du contenu tant que la réponse n'a pas commencé. */
	private showStatus(message: ChatMessage, code: string, label: string): void {
		if (message.status || !message.message) {
			message.status = code;
			message.message = label;
		}
	}

	/** `done` : la réponse est terminée et l'échange enregistré côté backend. */
	private complete(message: ChatMessage, messageId: string, interrupted: boolean): void {
		this.clearStatus(message);
		message.id = messageId;
		message.isCompleted = true;
		message.replaceableId = undefined;
		message.stopping = undefined;
		message.interrupted = interrupted || undefined;
	}

	private clearStatus(message: ChatMessage): void {
		if (message.status) {
			message.status = undefined;
			message.message = '';
		}
	}
}
