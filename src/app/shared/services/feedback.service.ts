import {Injectable} from '@angular/core';
import {HttpClient, HttpParams} from '@angular/common/http';
import {ConfigurationService} from '../../core/app-configuration/configuration.service';
import {Feedback, IFeedbackStats, IMessageFeedback, ISourceFeedback, SourceFeedback} from '../model/feedback';
import {Observable} from 'rxjs';

export type TimeRange = '7d' | '30d' | '90d' | 'all';

@Injectable({
	providedIn: 'root'
})
export class FeedbackService {
	constructor(
		private readonly http: HttpClient,
		private readonly config: ConfigurationService
	) {}

	stats(range: TimeRange = '30d'): Observable<IFeedbackStats> {
		const params = new HttpParams().set('range', range);
		return this.http.get<IFeedbackStats>(this.config.backendApi('/feedback/stats'), {params});
	}

	listMessageFeedback(range: TimeRange = '30d', includeDetails = true): Observable<IMessageFeedback[]> {
		let params = new HttpParams().set('range', range);
		if (includeDetails) params = params.set('includeDetails', 'true');
		return this.http.get<IMessageFeedback[]>(this.config.backendApi('/feedback/messages'), {params});
	}

	listSourceFeedback(range: TimeRange = '30d'): Observable<ISourceFeedback[]> {
		const params = new HttpParams().set('range', range);
		return this.http.get<ISourceFeedback[]>(this.config.backendApi('/feedback/sources'), {params});
	}

	public sendAnswerFeedback(feedback: Feedback) {
		return this.http.post<void>(this.config.backendApi('/conversations/feedbacks?type=answer'), feedback);
	}

	public sendSourceFeedback(feedback: SourceFeedback) {
		return this.http.post<void>(this.config.backendApi('/conversations/feedbacks?type=source'), feedback);
	}

	/** NEW: fetch existing feedbacks for the current user, for one answer */
	public getMySourceFeedbacks(conversationId: string, answerId: string): Observable<SourceFeedback[]> {
		const params = new HttpParams().set('type', 'source').set('conversationId', conversationId).set('messageId', answerId);

		// Expected response: [{ documentId, isPositive, comment? }, ...]
		return this.http.get<SourceFeedback[]>(this.config.backendApi('/conversations/feedbacks'), {params});
	}
}
