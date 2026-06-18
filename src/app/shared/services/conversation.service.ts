import {Injectable} from '@angular/core';
import {ConfigurationService} from '../../core/app-configuration/configuration.service';
import {Observable} from 'rxjs';
import {HttpClient, HttpEvent} from '@angular/common/http';
import {AttachmentUploadResponse, ChatTitle, Conversation} from '../model/chat-history';
import {ChatMessage} from '../model/chat-message';

@Injectable({
	providedIn: 'root'
})
export class ConversationService {
	constructor(
		private readonly config: ConfigurationService,
		private readonly http: HttpClient
	) {}

	getConversationTitles(): Observable<ChatTitle[]> {
		return this.http.get<ChatTitle[]>(this.config.backendApi('/conversations/titles'));
	}

	getAvailableWorkspaces(): Observable<string[]> {
		return this.http.get<string[]>(this.config.backendApi('/conversations/workspaces'));
	}

	getConversation(id: string): Observable<Conversation> {
		return this.http.get<Conversation>(this.config.backendApi(`/conversations/${id}`));
	}

	init(messages: ChatMessage[]) {
		return this.http.post(this.config.backendApi('/conversations/init'), messages);
	}

	update(id: string, messages: ChatMessage[]) {
		this.http.put(this.config.backendApi(`/conversations/${id}`), messages).subscribe();
	}

	deleteConversation(id: string) {
		return this.http.delete<void>(this.config.backendApi(`/conversations/${id}`));
	}

	renameConversation(id: string, newTitle: string): Observable<any> {
		return this.http.put<void>(this.config.backendApi(`/conversations/titles/${id}`), {newTitle});
	}

	uploadAttachments(currentConversation: ChatTitle, ...files: File[]): Observable<HttpEvent<AttachmentUploadResponse>> {
		const convId = currentConversation ? currentConversation.conversationId : undefined;
		let params = {};
		if (convId) {
			params = {conversationId: convId};
		}
		const formData = new FormData();
		files.forEach(file => formData.append('files', file, file.name));
		return this.http.post<AttachmentUploadResponse>(this.config.backendApi(`/conversations/attachments`), formData, {
			params,
			reportProgress: true,
			observe: 'events'
		});
	}

	deleteAttachment(attachmentId: number) {
		return this.http.delete<void>(this.config.backendApi(`/conversations/attachments/${attachmentId}`));
	}

	getConversationAttachmentsStatus(conversationId: string): Observable<AttachmentUploadResponse> {
		return this.http.get<AttachmentUploadResponse>(this.config.backendApi(`/conversations/${conversationId}/attachments`));
	}

	downloadAttachment(conversationId: string, attachmentId: number): Observable<Blob> {
		return this.http.get(this.config.backendApi(`/conversations/${conversationId}/attachments/${attachmentId}`), {
			responseType: 'blob'
		});
	}
}
