import {Injectable} from '@angular/core';
import {ChatMessage} from '../../shared/model/chat-message';
import {ChatStreamEvent} from '../../shared/model/chat-stream-event';

export interface StreamProcessingResult {
	/** Nouvelle version du message, après application des événements (le message reçu n'est pas modifié). */
	message: ChatMessage;
	/** `done` reçu : la réponse est terminée et enregistrée côté backend. */
	completed: boolean;
	/** `error` reçu : la génération a échoué, rien n'a été enregistré. */
	failed: boolean;
	newSuggestions: string[];
}

/**
 * Applique les événements typés du flux de réponse (T1) au message de l'assistant. Les mises à jour sont
 * immuables : un lot d'événements (une frame) produit une seule nouvelle version du message.
 */
@Injectable({
	providedIn: 'root'
})
export class ChatStreamProcessorService {
	apply(message: ChatMessage, events: ChatStreamEvent[]): StreamProcessingResult {
		const result: StreamProcessingResult = {message: {...message, sources: [...(message.sources ?? [])]}, completed: false, failed: false, newSuggestions: []};
		events.forEach(event => this.processEvent(event, result));
		return result;
	}

	/** Arrêt de la génération : la réponse partielle est conservée, le statut effacé. */
	interrupt(message: ChatMessage): ChatMessage {
		const next = {...message};
		this.clearStatus(next);
		next.stopping = undefined;
		next.isCompleted = true;
		next.interrupted = true;
		return next;
	}

	private processEvent(event: ChatStreamEvent, result: StreamProcessingResult): void {
		const message = result.message;
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
				message.sources.push(event.data);
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
