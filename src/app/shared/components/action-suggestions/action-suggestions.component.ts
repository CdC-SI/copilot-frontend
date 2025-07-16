import {Component, EventEmitter, Input, Output} from '@angular/core';

@Component({
	selector: 'zco-action-suggestions',
	templateUrl: './action-suggestions.component.html',
	styleUrls: ['./action-suggestions.component.scss']
})
export class ActionSuggestionsComponent {
	@Input() suggestions: {text: string; action: string}[];
	@Output() readonly actionSelected = new EventEmitter<string>();

	onActionClick(action: string): void {
		this.actionSelected.emit(action);
	}
}
