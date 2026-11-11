import {Injectable} from '@angular/core';
import {HttpClient, HttpParams} from '@angular/common/http';
import {ConfigurationService} from '../../core/app-configuration/configuration.service';
import {
	Feedback,
	FeedbackCategory,
	FeedbackReportConfig,
	FeedbackStatus,
	IFeedbackStats,
	IMessageFeedback,
	ISourceFeedback,
	SourceFeedback
} from '../model/feedback';
import {BehaviorSubject, Observable, forkJoin} from 'rxjs';
import {tap} from 'rxjs/operators';

export type TimeRange = '7d' | '30d' | '90d' | 'all';

@Injectable({
	providedIn: 'root'
})
export class FeedbackService {
	/** Number of NEW feedbacks (messages + sources), across all time ranges. Used for the admin panel badge. */
	public readonly newFeedbackCount$ = new BehaviorSubject<number>(0);

	constructor(
		private readonly http: HttpClient,
		private readonly config: ConfigurationService
	) {}

	stats(range: TimeRange = '30d'): Observable<IFeedbackStats> {
		const params = new HttpParams().set('range', range);
		return this.http.get<IFeedbackStats>(this.config.backendApi('/feedback/stats'), {params});
	}

	listMessageFeedback(range: TimeRange = '30d', includeDetails = true, status?: FeedbackStatus, category?: FeedbackCategory): Observable<IMessageFeedback[]> {
		let params = new HttpParams().set('range', range);
		if (includeDetails) params = params.set('includeDetails', 'true');
		if (status) params = params.set('status', status);
		if (category) params = params.set('category', category);
		return this.http.get<IMessageFeedback[]>(this.config.backendApi('/feedback/messages'), {params});
	}

	listSourceFeedback(range: TimeRange = '30d', status?: FeedbackStatus, category?: FeedbackCategory): Observable<ISourceFeedback[]> {
		let params = new HttpParams().set('range', range);
		if (status) params = params.set('status', status);
		if (category) params = params.set('category', category);
		return this.http.get<ISourceFeedback[]>(this.config.backendApi('/feedback/sources'), {params});
	}

	public updateMessageFeedbackStatus(id: number, status: FeedbackStatus): Observable<IMessageFeedback> {
		return this.http
			.patch<IMessageFeedback>(this.config.backendApi(`/feedback/messages/${id}/status`), {status})
			.pipe(tap(() => this.refreshNewFeedbackCount()));
	}

	public updateSourceFeedbackStatus(id: number, status: FeedbackStatus): Observable<ISourceFeedback> {
		return this.http
			.patch<ISourceFeedback>(this.config.backendApi(`/feedback/sources/${id}/status`), {status})
			.pipe(tap(() => this.refreshNewFeedbackCount()));
	}

	/** Refreshes the NEW feedback counter (messages + sources) used for the admin panel badge. */
	public refreshNewFeedbackCount(): void {
		forkJoin([
			this.listMessageFeedback('all', false, 'NEW'),
			this.listSourceFeedback('all', 'NEW')
		]).subscribe({
			next: ([messages, sources]) => this.newFeedbackCount$.next(messages.length + sources.length),
			error: () => {
				/* non-blocking: keep the previous count on failure */
			}
		});
	}

	public sendAnswerFeedback(feedback: Feedback) {
		return this.http.post<void>(this.config.backendApi('/conversations/feedbacks?type=answer'), feedback);
	}

	public sendSourceFeedback(feedback: SourceFeedback) {
		return this.http.post<void>(this.config.backendApi('/conversations/feedbacks?type=source'), feedback);
	}

	getReportConfig(): Observable<FeedbackReportConfig> {
		return this.http.get<FeedbackReportConfig>(this.config.backendApi('/feedback/report-config'));
	}

	updateReportConfig(reportConfig: FeedbackReportConfig): Observable<FeedbackReportConfig> {
		return this.http.put<FeedbackReportConfig>(this.config.backendApi('/feedback/report-config'), reportConfig);
	}

	/** NEW: fetch existing feedbacks for the current user, for one answer */
	public getMySourceFeedbacks(conversationId: string, answerId: string): Observable<SourceFeedback[]> {
		const params = new HttpParams().set('type', 'source').set('conversationId', conversationId).set('messageId', answerId);

		// Expected response: [{ documentId, isPositive, comment? }, ...]
		return this.http.get<SourceFeedback[]>(this.config.backendApi('/conversations/feedbacks'), {params});
	}
}
