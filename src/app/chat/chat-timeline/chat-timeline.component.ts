import {AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, OnDestroy, inject, signal, viewChild, viewChildren} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {NgClass} from '@angular/common';
import {MatMiniFabButton} from '@angular/material/button';
import {MatIcon} from '@angular/material/icon';
import {ChatMessageSource} from '../../shared/model/chat-message';
import {ChatMessageComponent} from '../../shared/components/chat-message/chat-message.component';
import {ChatScrollRequest} from '../chat.models';
import {ChatStore} from '../chat.store';

/** Fil de la conversation : messages, état vide et défilement vers la dernière question. */
@Component({
	selector: 'zco-chat-timeline',
	templateUrl: './chat-timeline.component.html',
	styleUrl: './chat-timeline.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NgClass, ChatMessageComponent, MatMiniFabButton, MatIcon]
})
export class ChatTimelineComponent implements AfterViewInit, OnDestroy {
	readonly showScrollToLastMessage = signal(false);
	protected readonly store = inject(ChatStore);
	protected readonly ChatMessageSource = ChatMessageSource;
	private readonly messageContainer = viewChild<ElementRef<HTMLElement>>('messageContainer');
	private readonly messageElements = viewChildren<ElementRef<HTMLElement>>('messageEl');
	private scrollVisibilityPending = false;
	private containerResizeObserver?: ResizeObserver;

	constructor() {
		this.store.scrollRequests.pipe(takeUntilDestroyed()).subscribe(request => this.onScrollRequest(request));
	}

	ngAfterViewInit(): void {
		const el = this.messageContainer()?.nativeElement;
		if (!el) return;
		this.containerResizeObserver = new ResizeObserver(() => {
			el.style.setProperty('--container-height', `${el.clientHeight}px`);
		});
		this.containerResizeObserver.observe(el);
	}

	ngOnDestroy(): void {
		this.containerResizeObserver?.disconnect();
	}

	updateScrollButtonVisibility(): void {
		if (this.scrollVisibilityPending) return;
		this.scrollVisibilityPending = true;
		requestAnimationFrame(() => {
			this.scrollVisibilityPending = false;
			const el = this.messageContainer()?.nativeElement;
			const lastUserEl = this.getLastUserElement();
			if (el && lastUserEl) {
				this.showScrollToLastMessage.set(el.scrollTop < this.getTargetScrollTop(el, lastUserEl) - 10);
			}
		});
	}

	scrollToLastUserMessage(): void {
		setTimeout(() => {
			const el = this.messageContainer()?.nativeElement;
			const lastUserEl = this.getLastUserElement();
			if (!el || !lastUserEl) return this.resetScrollState();
			el.scrollTo({top: this.getTargetScrollTop(el, lastUserEl), behavior: 'smooth'});
			this.showScrollToLastMessage.set(false);
		});
	}

	private onScrollRequest(request: ChatScrollRequest): void {
		if (request === 'last-user') {
			this.scrollToLastUserMessage();
		} else if (request === 'reset') {
			this.resetScrollState();
		} else {
			this.updateScrollButtonVisibility();
		}
	}

	private getTargetScrollTop(el: HTMLElement, userEl: HTMLElement): number {
		return el.scrollTop + userEl.getBoundingClientRect().top - el.getBoundingClientRect().top;
	}

	/** Élément de la dernière question, en alignant les éléments rendus sur la fin de la liste des messages. */
	private getLastUserElement(): HTMLElement | null {
		const messages = this.store.messages();
		const elements = this.messageElements();
		for (let i = 1; i <= elements.length; i++) {
			if (messages[messages.length - i]?.source === ChatMessageSource.USER) return elements[elements.length - i].nativeElement;
		}
		return null;
	}

	private resetScrollState(): void {
		const el = this.messageContainer()?.nativeElement;
		if (!el) return;
		el.scrollTop = 0;
		this.showScrollToLastMessage.set(false);
	}
}
