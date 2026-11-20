import {ChangeDetectionStrategy, Component, inject} from '@angular/core';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {MatIconButton} from '@angular/material/button';
import {MatIcon} from '@angular/material/icon';
import {MatTooltip} from '@angular/material/tooltip';
import {TranslatePipe} from '@ngx-translate/core';
import {ObButtonDirective, ObIconButtonDirective} from '@oblique/oblique';
import {ActionSuggestionsComponent} from '../../shared/components/action-suggestions/action-suggestions.component';
import {AutocompleteInputComponent} from '../../shared/components/autocomplete-input/autocomplete-input.component';
import {DynamicFormComponent} from '../../shared/components/dynamic-form/dynamic-form.component';
import {QuestionSuggestionComponent} from '../../shared/components/question-suggestion/question-suggestion.component';
import {AutocompleteType} from '../services';
import {ChatStore} from '../chat.store';
import {ChatAttachmentsComponent} from './chat-attachments/chat-attachments.component';

/** Zone de saisie : formulaire dynamique, suggestions, question (FAQ, commandes), Stop, pièces jointes et avertissement IA. */
@Component({
	selector: 'zco-chat-composer',
	templateUrl: './chat-composer.component.html',
	styleUrl: './chat-composer.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		DynamicFormComponent,
		QuestionSuggestionComponent,
		ActionSuggestionsComponent,
		FormsModule,
		ReactiveFormsModule,
		AutocompleteInputComponent,
		MatIconButton,
		ObIconButtonDirective,
		ObButtonDirective,
		MatTooltip,
		MatIcon,
		ChatAttachmentsComponent,
		TranslatePipe
	]
})
export class ChatComposerComponent {
	protected readonly store = inject(ChatStore);
	readonly searchOptionLabelFn = (option: AutocompleteType): string => this.store.optionLabel(option);
}
