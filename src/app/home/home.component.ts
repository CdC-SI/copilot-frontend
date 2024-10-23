import {ChangeDetectorRef, Component, OnInit, Renderer2} from '@angular/core';
import {FaqItemsService} from '../shared/services/faq-items.service';
import {FormControl} from '@angular/forms';
import {IQuestion, Language} from '../shared/model/answer';
import {RagService} from '../shared/services/rag.service';
import {ANCHOR_TAG_REGEX, clearNullAndEmpty} from '../shared/utils/zco-utils';
import {ChatMessage, ChatMessageSource} from '../shared/model/chat-message';
import {SpeechService} from '../shared/services/speech.service';
import {IUser} from '../shared/model/user';
import {UserService} from '../shared/services/user.service';

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
		private readonly renderer: Renderer2,
		private readonly speechService: SpeechService,
		private readonly userService: UserService
	) {}

	ngOnInit() {
		this.speechService.speechStartEvent.subscribe(() => {
			this.messages.forEach(message => {
				message.beingSpoken = false;
			});
		});
	}

	isAuthenticated(): boolean {
		return this.userService.isAuthenticated();
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
		this.addMessage(ChatMessageSource.USER, question.text, false, true, question.language, question.id);
		this.addMessage(ChatMessageSource.FAQ, question.answer.text, false, true, question.language, question.id, question.url);
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
		this.addMessage(ChatMessageSource.LLM, '', false, false);
		this.disableSearch();
		this.ragService.process(clearNullAndEmpty({query: this.searchCtrl.value, ...this.chatConfigCtrl.value})).subscribe({
			next: chunk => {
				this.buildResponseWithLLMChunk(this.messages[this.messages.length - 1], chunk);
				this.cdr.markForCheck();
			},
			error: () => {
				this.messages.pop();
				this.addMessage(ChatMessageSource.LLM, 'Une erreur est survenue. Veuillez réessayer.', true);
				this.enableSearch();
			}
		});

		this.clearSearch();
	}

	buildResponseWithLLMChunk(partialChatMessage: ChatMessage, chunk: string): void {
		const partialText = chunk;
		if (!partialText) return;

		const anchorTagMatch = ANCHOR_TAG_REGEX.exec(partialText);
		partialChatMessage.message += partialText.replace(ANCHOR_TAG_REGEX, '');
		if (anchorTagMatch) {
			partialChatMessage.url = anchorTagMatch[1];
			partialChatMessage.isCompleted = true;
			this.scrollToBottom();
			this.enableSearch();
		}
	}

	addMessage(source: ChatMessageSource, message: string, inError = false, isCompleted = true, lang?: Language, faqItemId?: number, url?: string) {
		this.messages.push({faqItemId, message, source, isCompleted, timestamp: new Date(), lang, url, inError, beingSpoken: false});
	}

	scrollToBottom(): void {
		setTimeout(() => {
			const mainContainer = document.querySelector('.message-container');
			if (mainContainer) {
				mainContainer.scrollTop = mainContainer.scrollHeight;
			}
		});
	}
}
