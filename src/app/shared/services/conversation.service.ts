import {Injectable} from '@angular/core';
import {ConfigurationService} from '../../core/app-configuration/configuration.service';
import {Observable, of} from 'rxjs';
import {HttpClient} from '@angular/common/http';
import {ChatHistoryMessage, ChatTitle} from '../model/chat-history';
import {ChatMessage, ChatMessageSource} from '../model/chat-message';

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
	getConversation(id: string): Observable<ChatHistoryMessage[]> {
		return this.http.get<ChatHistoryMessage[]>(this.config.backendApi(`/conversations/${id}`));
	}

	init(messages: ChatMessage[]) {
		return this.http.post(this.config.backendApi('/conversations/init'), messages);
	}

	update(id: string, messages: ChatMessage[]) {
		this.http.put(this.config.backendApi(`/conversations/${id}`), messages).subscribe();
	}

	deleteConversation(id: string): Observable<any> {
		return this.http.delete(this.config.backendApi(`/conversations/${id}`));
	}

	renameConversation(id: string, newTitle: string): Observable<any> {
		return this.http.put(this.config.backendApi(`/conversations/${id}/title`), { title: newTitle });
	}
}
