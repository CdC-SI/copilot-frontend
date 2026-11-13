import {Injectable} from '@angular/core';
import {ChatRequest} from '../model/rag';
import {ConfigurationService} from '../../core/app-configuration/configuration.service';
import {Observable} from 'rxjs';
import {SseClientService} from './sse-client.service';

@Injectable({
	providedIn: 'root'
})
export class RagService {
	constructor(
		private readonly config: ConfigurationService,
		private readonly sseClient: SseClientService
	) {}

	/** Flux des données SSE de la réponse ; se désabonner annule la génération côté client. */
	process(ragRequest: ChatRequest): Observable<string> {
		return this.sseClient.post(this.config.backendApi('/conversations'), this.buildFormDataFromChatRequest(ragRequest));
	}

	private buildFormDataFromChatRequest(ragRequest: ChatRequest): FormData {
		const fd = new FormData();

		// required
		fd.append('query', ragRequest.query);

		// optional
		this.append(fd, 'language', ragRequest.language);
		this.append(fd, 'conversationId', ragRequest.conversationId);
		this.append(fd, 'workspace', ragRequest.workspace);
		this.append(fd, 'ragEnabled', ragRequest.ragEnabled);

		return fd;
	}

	private append(fd: FormData, key: string, value: string | boolean | undefined | null) {
		if (value !== undefined && value !== null) {
			fd.append(key, String(value));
		}
	}
}
