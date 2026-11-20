import {ChangeDetectionStrategy, Component, EventEmitter, Input, Output} from '@angular/core';
import {FEEDBACK_STATUSES, FeedbackStatus} from '../../../shared/model/feedback';
import {MatSelect, MatSelectTrigger} from '@angular/material/select';
import {NgClass} from '@angular/common';
import {MatOption} from '@angular/material/core';
import {TranslatePipe} from '@ngx-translate/core';

@Component({
	selector: 'zco-feedback-status-select',
	templateUrl: './feedback-status-select.component.html',
	styleUrl: './feedback-status-select.component.scss',
	changeDetection: ChangeDetectionStrategy.Eager,
	imports: [MatSelect, NgClass, MatSelectTrigger, MatOption, TranslatePipe]
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
