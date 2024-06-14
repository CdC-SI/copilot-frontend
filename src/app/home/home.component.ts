import {ChangeDetectorRef, Component} from '@angular/core';
import {AutocompleteService} from '../shared/services/autocomplete.service';
import {FormControl} from '@angular/forms';
import {IAnswer} from '../shared/model/answer';
import {RagService} from '../shared/services/rag.service';
import {ChatMessage} from '../shared/services/chat-message';
import {ObSpinnerService} from '@oblique/oblique';

@Component({
	selector: 'zco-home',
	templateUrl: './home.component.html',
	styleUrls: ['./home.component.scss']
})
export class HomeComponent {
	searchCtrl = new FormControl();
	messages: ChatMessage[] = [];
	chatIsSpeaking = false;

	constructor(
		private readonly searchService: AutocompleteService,
		private readonly ragService: RagService,
		private readonly cdr: ChangeDetectorRef,
		private readonly spinner: ObSpinnerService
	) {}

	getSearchProposalFunction = (text: string) => {
		return this.searchService.search(text);
	};

	searchOptionLabelFn = (answer: IAnswer): string => answer?.question;

	selectOption($event: IAnswer) {
		this.messages.push({message: $event.question, fromMe: true, timestamp: new Date()});
		this.messages.push({message: $event.answer, fromMe: false, url: $event.url, timestamp: new Date()});
		this.searchCtrl.setValue('');
		this.scrollToBottom();
	}

	scrollToBottom() {
		setTimeout(() => {
			const mainContainer = document.getElementsByClassName('ob-master-layout-wrapper')[0];
			mainContainer.scrollTop = mainContainer.scrollHeight;
		});
	}

	clearChat() {
		this.messages = [];
	}

	send() {
		this.chatIsSpeaking = true;
		this.messages.push({message: this.searchCtrl.value, fromMe: true, timestamp: new Date()});
		this.messages.push({message: '', fromMe: false, timestamp: new Date()});
		this.ragService.process({query: this.searchCtrl.value}).subscribe((event: any) => {
			this.searchCtrl.setValue('');
			this.spinner.deactivate();
			if (event.partialText) {
				if (event.partialText.indexOf('<a href=') !== -1) {
					this.messages[this.messages.length - 1].message = event.partialText.substring(0, event.partialText.indexOf('<a href='));
					this.messages[this.messages.length - 1].url = event.partialText.substring(
						event.partialText.indexOf('<a href=') + 9,
						event.partialText.indexOf("' target='_blank'")
					);
					this.chatIsSpeaking = false;
					this.spinner.activate();
				} else {
					this.messages[this.messages.length - 1].message = event.partialText;
				}
				this.scrollToBottom();
			}
			this.cdr.detectChanges();
		});
	}
}
