import {ChangeDetectorRef, Component, OnInit, Renderer2} from '@angular/core';
import {FaqItemsService} from '../shared/services/faq-items.service';
import {FormControl} from '@angular/forms';
import {IQuestion, Language} from '../shared/model/answer';
import {RagService} from '../shared/services/rag.service';
import {ANCHOR_TAG_REGEX, clearNullAndEmpty} from '../shared/utils/zco-utils';
import {ChatMessage, ChatMessageSource} from '../shared/model/chat-message';

@Component({
	selector: 'zco-home',
	templateUrl: './home.component.html',
	styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {
	Object = Object;
	searchCtrl = new FormControl();
	chatConfigCtrl = new FormControl();
	messages: ChatMessage[] = [];

	protected readonly ChatMessageSource = ChatMessageSource;

	constructor(
		private readonly autocompleteService: FaqItemsService,
		private readonly ragService: RagService,
		private readonly cdr: ChangeDetectorRef,
		private readonly renderer: Renderer2
	) {}

	ngOnInit() {
		speechSynthesis.cancel();
	}

	closeRightPanel() {
		const element = document.querySelector('.ob-column-right');
		if (element) {
			this.renderer.addClass(element, 'ob-collapsed');
		}
	}

	getSearchProposalFunction = (text: string) => {
		return this.autocompleteService.search(text);
	};

	searchOptionLabelFn = (question: IQuestion): string => question?.text ?? '';

	selectFaqOption(question: IQuestion): void {
		this.addMessage(ChatMessageSource.USER, question.text, false, false, question.language, question.id);
		this.addMessage(ChatMessageSource.FAQ, question.answer.text, false, false, question.language, question.id, question.url);
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

	newChat(): void {
		// todo
	}

	sendToLLM(): void {
		this.addMessage(ChatMessageSource.USER, this.searchCtrl.value);
		this.addMessage(ChatMessageSource.LLM, '', true);
		this.disableSearch();
		this.ragService.process(clearNullAndEmpty({query: this.searchCtrl.value, ...this.chatConfigCtrl.value})).subscribe({
			next: event => {
				this.buildResponseWithLLMEvent(this.messages[this.messages.length - 1], event);
				this.cdr.markForCheck();
			},
			error: () => {
				this.messages.pop();
				this.addMessage(ChatMessageSource.LLM, 'Une erreur est survenue. Veuillez réessayer.', true, false);
				this.enableSearch();
			}
		});

		this.clearSearch();
	}

	buildResponseWithLLMEvent(partialChatMessage: ChatMessage, event: any): void {
		const partialText = event.partialText || '';
		if (!partialText) return;

		const anchorTagMatch = ANCHOR_TAG_REGEX.exec(partialText);
		partialChatMessage.message = partialText.replace(ANCHOR_TAG_REGEX, '').trim();
		if (anchorTagMatch) {
			partialChatMessage.url = anchorTagMatch[1];
			partialChatMessage.beingSpoken = false;
			this.scrollToBottom();
			this.enableSearch();
		}
	}

	addMessage(source: ChatMessageSource, message: string, inError = false, beingSpoken = false, lang?: Language, faqItemId?: number, url?: string) {
		this.messages.push({faqItemId, message, source, beingSpoken, timestamp: new Date(), lang, url, inError});
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
