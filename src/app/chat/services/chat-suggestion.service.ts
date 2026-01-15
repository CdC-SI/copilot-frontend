import {Injectable} from '@angular/core';
import {FormGroup} from '@angular/forms';
import {TranslateService} from '@ngx-translate/core';
import {DynamicFormService} from '../../shared/services/dynamic-form.service';
import {ActionId, FormDef} from '../../shared/model/form-definition';
import {ChatMessage} from '../../shared/model/chat-message';
import {DEFAULT_CHAT_SUGGESTIONS} from './chat.constants';

export interface ActionSuggestion {
	text: string;
	action: string;
}

@Injectable({
	providedIn: 'root'
})
export class ChatSuggestionService {
	private specificSuggestions: ActionSuggestion[] = [];

	constructor(
		private readonly translateService: TranslateService,
		private readonly dfs: DynamicFormService
	) {}

	getDefaultSuggestions(): ActionSuggestion[] {
		return DEFAULT_CHAT_SUGGESTIONS;
	}

	getSpecificSuggestions(): ActionSuggestion[] {
		return this.specificSuggestions;
	}

	addSpecificSuggestion(action: string): void {
		this.specificSuggestions.push({
			text: `action_suggestions.${action}`,
			action
		});
	}

	clearSpecificSuggestions(): void {
		this.specificSuggestions = [];
	}

	setSpecificSuggestionsFromMessages(messages: ChatMessage[]): void {
		const lastMessage = messages.at(-1);
		this.specificSuggestions =
			lastMessage?.suggestions?.map(suggestion => ({
				text: `action_suggestions.${suggestion}`,
				action: suggestion
			})) || [];
	}

	handleSuggestionAction(
		action: string,
		messages: ChatMessage[]
	): {
		shouldShowForm: boolean;
		formDef?: FormDef;
		formGroup?: FormGroup;
		searchValue?: string;
	} {
		if (action === 'ii-salary') {
			const activeForm = this.dfs.buildForm(ActionId.II_CALCUL);
			const lastAssistant = messages.at(-1);
			const patch = this.dfs.parseAssistantMessage(activeForm.def, lastAssistant.message);
			activeForm.group.patchValue(patch, {emitEvent: false});

			return {
				shouldShowForm: true,
				formDef: activeForm.def,
				formGroup: activeForm.group
			};
		}
		const prefix = this.translateService.instant(`action_suggestions.prefixes.${action}`);
		return {
			shouldShowForm: false,
			searchValue: prefix
		};
	}
}
