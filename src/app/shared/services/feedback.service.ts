import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {ConfigurationService} from '../../core/app-configuration/configuration.service';
import {Feedback} from '../model/feedback';

@Injectable({
	providedIn: 'root'
})
export class FeedbackService {
	constructor(
		private readonly http: HttpClient,
		private readonly config: ConfigurationService
	) {}

	public sendFeeback(feedback: Feedback) {
		return this.http.post<void>(this.config.backendApi('/conversations/feedbacks'), feedback);
	}
}
