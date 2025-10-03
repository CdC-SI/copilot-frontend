import {Injectable} from '@angular/core';
import {HttpClient, HttpParams} from '@angular/common/http';
import {ConfigurationService} from '../../core/app-configuration/configuration.service';
import {Feedback, SourceFeedback} from '../model/feedback';
import {Observable} from 'rxjs';

@Injectable({
	providedIn: 'root'
})
export class FeedbackService {
	constructor(
		private readonly http: HttpClient,
		private readonly config: ConfigurationService
	) {}

	public sendFeeback(feedback: Feedback) {
		return this.http.post<void>(this.config.backendApi('/conversations/feedbacks?type=answer'), feedback);
	}

	public sendFeedback(feedback: SourceFeedback) {
		return this.http.post<void>(this.config.backendApi('/conversations/feedbacks?type=source'), feedback);
	}

	/** NEW: fetch existing feedbacks for the current user, for one answer */
	public getMySourceFeedbacks(conversationId: string, answerId: string): Observable<SourceFeedback[]> {
		const params = new HttpParams().set('type', 'source').set('conversationId', conversationId).set('messageId', answerId);

		// Expected response: [{ documentId, isPositive, comment? }, ...]
		return this.http.get<SourceFeedback[]>(this.config.backendApi('/conversations/feedbacks'), {params});
	}
}
