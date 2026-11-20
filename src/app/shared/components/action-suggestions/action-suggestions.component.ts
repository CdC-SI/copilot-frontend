import {ChangeDetectionStrategy, Component, EventEmitter, Input, Output} from '@angular/core';
import {MatButton} from '@angular/material/button';
import {ObButtonDirective, ObIconButtonDirective} from '@oblique/oblique';
import {TranslatePipe} from '@ngx-translate/core';

@Component({
	selector: 'zco-action-suggestions',
	templateUrl: './action-suggestions.component.html',
	styleUrls: ['./action-suggestions.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [MatButton, ObIconButtonDirective, ObButtonDirective, TranslatePipe]
})
export class ActionSuggestionsComponent {
	@Input() suggestions: {text: string; action: string}[];
	@Output() readonly actionSelected = new EventEmitter<string>();

	onActionClick(action: string): void {
		this.actionSelected.emit(action);
	}
}
