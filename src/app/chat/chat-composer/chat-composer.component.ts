import {ChangeDetectionStrategy, Component, afterNextRender, effect, inject, viewChild} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {MatIconButton} from '@angular/material/button';
import {MatIcon} from '@angular/material/icon';
import {MatTooltip} from '@angular/material/tooltip';
import {TranslatePipe} from '@ngx-translate/core';
import {ObButtonDirective, ObIconButtonDirective} from '@oblique/oblique';
import {ActionSuggestionsComponent} from '../../shared/components/action-suggestions/action-suggestions.component';
import {AutocompleteInputComponent} from '../../shared/components/autocomplete-input/autocomplete-input.component';
import {DynamicFormComponent} from '../../shared/components/dynamic-form/dynamic-form.component';
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
	private readonly input = viewChild(AutocompleteInputComponent);
	private wasGenerating = false;

	constructor() {
		afterNextRender(() => this.focusInput());
		this.store.focusRequests.pipe(takeUntilDestroyed()).subscribe(() => this.focusInput());
		// Fin de la réponse : la saisie, réactivée, reprend le focus.
		effect(() => {
			const generating = this.store.isGenerating();
			if (this.wasGenerating && !generating) this.focusInput();
			this.wasGenerating = generating;
		});
	}

	readonly searchOptionLabelFn = (option: AutocompleteType): string => this.store.optionLabel(option);

	/** Donne le focus à la saisie, sauf si l'utilisateur est en train d'écrire dans un autre champ. */
	private focusInput(): void {
		setTimeout(() => {
			const active = document.activeElement;
			if (active instanceof HTMLElement && active.matches('input, textarea, select, [contenteditable="true"]')) return;
			this.input()?.focus();
		});
	}
}
