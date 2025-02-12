import { Component, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'zco-action-suggestions',
  templateUrl: './action-suggestions.component.html',
  styleUrls: ['./action-suggestions.component.scss']
})
export class ActionSuggestionsComponent {
  @Output() actionSelected = new EventEmitter<string>();

  suggestions = [
    { text: 'action_suggestions.translate', action: 'translate' },
    { text: 'action_suggestions.summarize', action: 'summarize' },
    { text: 'action_suggestions.explain', action: 'explain' },
    { text: 'action_suggestions.reformulate', action: 'reformulate' },
    { text: 'action_suggestions.draft', action: 'draft' },
    { text: 'action_suggestions.more', action: 'more' }
  ];

  onActionClick(action: string): void {
    this.actionSelected.emit(action);
  }
}
