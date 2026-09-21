import {Component, EventEmitter, Input, Output} from '@angular/core';
import {FEEDBACK_STATUSES, FeedbackStatus} from '../../../shared/model/feedback';

@Component({
	selector: 'zco-feedback-status-select',
	templateUrl: './feedback-status-select.component.html',
	styleUrl: './feedback-status-select.component.scss'
})
export class FeedbackStatusSelectComponent {
	@Input() status: FeedbackStatus = 'NEW';
	@Input() disabled = false;
	@Output() readonly statusChange = new EventEmitter<FeedbackStatus>();

	readonly statuses = FEEDBACK_STATUSES;

	onChange(status: FeedbackStatus): void {
		if (status === this.status) return;
		this.status = status;
		this.statusChange.emit(status);
	}
}
