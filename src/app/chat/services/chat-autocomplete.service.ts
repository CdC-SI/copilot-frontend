import {Injectable} from '@angular/core';
import {Observable, of} from 'rxjs';
import {FaqItemsService} from '../../shared/services/faq-items.service';
import {Command, CommandService} from '../../shared/services/command.service';
import {IQuestion} from '../../shared/model/answer';

export type AutocompleteType = IQuestion | Command;

@Injectable({
	providedIn: 'root'
})
export class ChatAutocompleteService {
	constructor(
		private readonly faqItemsService: FaqItemsService,
		private readonly commandService: CommandService
	) {}

	getOptionService(isCommandMode: boolean, hasCurrentConversation: boolean): (text: string) => Observable<AutocompleteType[]> {
		if (isCommandMode) {
			return (text: string) => this.commandService.searchCommands(text);
		}
		if (hasCurrentConversation) {
			return () => of([]);
		}
		return (text: string) => this.faqItemsService.search(text);
	}

	getOptionLabel(option: AutocompleteType, isCommandMode: boolean): string {
		if (isCommandMode && 'name' in option) {
			return option.name;
		}
		return (option as IQuestion)?.text ?? '';
	}

	isCommand(option: AutocompleteType): option is Command {
		return 'name' in option;
	}

	isFaqQuestion(option: AutocompleteType): option is IQuestion {
		return 'text' in option && 'answer' in option;
	}
}
