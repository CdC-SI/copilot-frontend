import {ChangeDetectorRef, Component, OnInit} from '@angular/core';
import {AutocompleteService} from '../shared/services/autocomplete.service';
import {FormControl} from '@angular/forms';
import {IAnswer} from '../shared/model/answer';
import {RagService} from '../shared/services/rag.service';
import {ChatMessage, ChatMessageSource} from '../shared/services/chat-message';
import {ObSpinnerService} from '@oblique/oblique';
import {Router} from '@angular/router';
import {AdminService} from '../shared/services/admin.service';
import {TranslateService} from '@ngx-translate/core';
import {SpeechService} from '../shared/services/speech.service';

@Component({
	selector: 'zco-home',
	templateUrl: './home.component.html',
	styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {
	searchCtrl = new FormControl();
	messages: ChatMessage[] = [];
	chatIsSpeaking = false;

	protected readonly ChatMessageSource = ChatMessageSource;

	constructor(
		private readonly autocompleteService: AutocompleteService,
		private readonly ragService: RagService,
		private readonly cdr: ChangeDetectorRef,
		private readonly spinner: ObSpinnerService,
		private readonly router: Router,
		private readonly adminService: AdminService,
		private readonly translateService: TranslateService,
		private readonly speechService: SpeechService
	) {}

	ngOnInit() {
		speechSynthesis.cancel();
	}
	getSearchProposalFunction = (text: string) => {
		return this.autocompleteService.search(text);
	};

	searchOptionLabelFn = (answer: IAnswer): string => answer?.question;

	selectOption($event: IAnswer) {
		this.messages.push({faqItemId: $event.id, message: $event.question, source: ChatMessageSource.USER, timestamp: new Date(), lang: $event.language});
		this.messages.push({
			faqItemId: $event.id,
			message: $event.answer,
			source: ChatMessageSource.FAQ,
			url: $event.url,
			timestamp: new Date(),
			lang: $event.language
		});
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

	editLLMAnswer() {
		const question = this.messages[this.messages.length - 2];
		const answer = this.messages[this.messages.length - 1];
		const language = this.translateService.currentLang;
		this.adminService.setLlmAnswerToInsert({id: answer.faqItemId, question: question.message, answer: answer.message, url: answer.url, language});
		void this.router.navigate(['/admin']);
	}

	speak(message: ChatMessage) {
		speechSynthesis.cancel();
		if (!message.beingSpoken) {
			message.beingSpoken = true;
			const speech = new SpeechSynthesisUtterance();
			speech.text = message.message;
			speech.rate = 1.5;
			speech.pitch = 1;
			speech.voice = this.speechService.getVoice(message.lang || this.translateService.currentLang);
			speechSynthesis.speak(speech);
		} else {
			message.beingSpoken = false;
		}
	}

	send() {
		this.chatIsSpeaking = true;
		this.messages.push({message: this.searchCtrl.value, source: ChatMessageSource.USER, timestamp: new Date()});
		this.messages.push({message: '', source: ChatMessageSource.LLM, timestamp: new Date()});
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
