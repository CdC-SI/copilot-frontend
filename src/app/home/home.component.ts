import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, TemplateRef, ViewChild } from "@angular/core";
import {AutocompleteService} from '../shared/services/autocomplete.service';
import { FormControl } from "@angular/forms";
import {IQuestion, Language} from '../shared/model/answer';
import {RagService} from '../shared/services/rag.service';
import {ChatMessage, ChatMessageSource} from '../shared/services/chat-message';
import {ANCHOR_TAG_REGEX} from '../shared/utils/zco-utils';

@Component({
	selector: 'zco-home',
	templateUrl: './home.component.html',
	styleUrls: ['./home.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class HomeComponent implements OnInit {
	searchCtrl = new FormControl();
	messages: ChatMessage[] = [];

	protected readonly ChatMessageSource = ChatMessageSource;

	constructor(
		private readonly autocompleteService: AutocompleteService,
		private readonly ragService: RagService,
		private readonly cdr: ChangeDetectorRef
	) {}

	ngOnInit() {
		speechSynthesis.cancel();
	}

	getSearchProposalFunction = (text: string) => {
		return this.autocompleteService.search(text);
	};

	searchOptionLabelFn = (question: IQuestion): string => question?.text ?? '';

	selectFaqOption(question: IQuestion): void {
		this.addMessage(ChatMessageSource.USER, question.text, false, question.language, question.id);
		this.addMessage(ChatMessageSource.FAQ, question.answer.text, false, question.language, question.id, question.url);
		this.clearSearch();
		this.scrollToBottom();
	}

	clearSearch(): void {
		this.searchCtrl.setValue('');
	}

	disableSearch(): void {
		this.searchCtrl.disable();
	}

	enableSearch(): void {
		this.searchCtrl.enable();
	}

	clearChat(): void {
		this.messages = [];
	}

	sendToLLM(): void {
		this.addMessage(ChatMessageSource.USER, this.searchCtrl.value);
		this.addMessage(ChatMessageSource.LLM, '', true);
		this.clearSearch();
		this.disableSearch();
		this.ragService.process({query: this.searchCtrl.value}).subscribe(event => {
			this.buildResponseWithLLMEvent(this.messages[this.messages.length - 1], event);
			this.cdr.markForCheck();
		});
	}

	buildResponseWithLLMEvent(partialChatMessage: ChatMessage, event: any): void {
		const partialText = event.partialText || '';
		if (!partialText) return;

		const anchorTagMatch = ANCHOR_TAG_REGEX.exec(partialText);
		partialChatMessage.message = partialText.replace(ANCHOR_TAG_REGEX, '').trim();
		if (anchorTagMatch) {
			partialChatMessage.url = anchorTagMatch[1];
			partialChatMessage.beingSpoken = false;
			this.enableSearch();
			this.scrollToBottom();
		}
	}

	addMessage(source: ChatMessageSource, message: string, beingSpoken = false, lang?: Language, faqItemId?: number, url?: string) {
		this.messages.push({faqItemId, message, source, beingSpoken, timestamp: new Date(), lang, url});
	}

	scrollToBottom(): void {
		setTimeout(() => {
			const mainContainer = document.querySelector('.ob-master-layout-wrapper');
			if (mainContainer) {
				mainContainer.scrollTop = mainContainer.scrollHeight;
			}
		});
	}
}
