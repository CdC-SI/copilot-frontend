import {Component} from '@angular/core';
import {SearchService} from '../shared/services/search.service';
import {FormControl} from '@angular/forms';
import {IAnswer} from '../shared/model/answer';
import {ObHttpApiInterceptorConfig} from '@oblique/oblique';

@Component({
	selector: 'zco-home',
	templateUrl: './home.component.html',
	styleUrls: ['./home.component.scss']
})
export class HomeComponent {
	searchCtrl = new FormControl();
	messages: any[] = [];

	constructor(private readonly searchService: SearchService) {}

	getSearchProposalFunction = (text: string) => {
		return this.searchService.search(text);
	};

	searchOptionLabelFn = (answer: IAnswer): string => answer?.question;

	selectOption($event: IAnswer) {
		this.messages.push({text: $event.question, fromMe: true});
		this.messages.push({text: $event.answer, fromMe: false});
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
}
