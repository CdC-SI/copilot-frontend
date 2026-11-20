import {
	AfterViewInit,
	ChangeDetectionStrategy,
	Component,
	ElementRef,
	OnDestroy,
	effect,
	inject,
	signal,
	untracked,
	viewChild,
	viewChildren
} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {NgClass} from '@angular/common';
import {MatMiniFabButton} from '@angular/material/button';
import {MatIcon} from '@angular/material/icon';
import {TranslatePipe} from '@ngx-translate/core';
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
	imports: [NgClass, ChatMessageComponent, MatMiniFabButton, MatIcon, TranslatePipe]
})
export class ChatTimelineComponent implements AfterViewInit, OnDestroy {
	readonly showScrollToLastMessage = signal(false);
	/**
	 * Espace sous le dernier tour, seulement pour une question envoyée dans la session : juste assez pour amener
	 * la question en haut du fil, 0 si le tour remplit le fil ou si la conversation vient d'être ouverte.
	 */
	readonly bottomSpacerHeight = signal(0);
	protected readonly store = inject(ChatStore);
	protected readonly ChatMessageSource = ChatMessageSource;
	private readonly messageContainer = viewChild<ElementRef<HTMLElement>>('messageContainer');
	private readonly messageElements = viewChildren<ElementRef<HTMLElement>>('messageEl');
	private scrollVisibilityPending = false;
	private layoutObserver?: ResizeObserver;
	private pinLastTurn = false;

	constructor() {
		this.store.scrollRequests.pipe(takeUntilDestroyed()).subscribe(request => this.onScrollRequest(request));
		// Le dernier tour change (nouvelle question, réponse en cours, autre conversation) : on observe ses messages.
		effect(() => {
			this.messageElements();
			untracked(() => this.observeLayout());
		});
	}

	ngAfterViewInit(): void {
		if (typeof ResizeObserver === 'undefined') return;
		this.layoutObserver = new ResizeObserver(() => this.updateBottomSpacer());
		this.observeLayout();
	}

	ngOnDestroy(): void {
		this.layoutObserver?.disconnect();
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
		if (request === 'last-user' || request === 'opened') {
			this.pinLastTurn = request === 'last-user';
			this.updateBottomSpacer();
			this.scrollToLastUserMessage();
		} else if (request === 'reset') {
			this.pinLastTurn = false;
			this.resetScrollState();
		} else {
			this.updateScrollButtonVisibility();
		}
	}

	/** Observe le fil et les messages du dernier tour (dernière question et suivants). */
	private observeLayout(): void {
		const el = this.messageContainer()?.nativeElement;
		if (!this.layoutObserver || !el) return;
		this.layoutObserver.disconnect();
		this.layoutObserver.observe(el);
		const elements = this.messageElements().map(ref => ref.nativeElement);
		const lastUserEl = this.getLastUserElement();
		elements.slice(lastUserEl ? elements.indexOf(lastUserEl) : elements.length).forEach(message => this.layoutObserver?.observe(message));
		this.updateBottomSpacer();
	}

	private updateBottomSpacer(): void {
		const el = this.messageContainer()?.nativeElement;
		const lastUserEl = this.getLastUserElement();
		const lastEl = this.messageElements().at(-1)?.nativeElement;
		if (!this.pinLastTurn || !el || !lastUserEl || !lastEl) {
			this.bottomSpacerHeight.set(0);
			return;
		}
		const lastTurnHeight = lastEl.offsetTop + lastEl.offsetHeight - lastUserEl.offsetTop;
		this.bottomSpacerHeight.set(Math.max(0, Math.round(el.clientHeight - lastTurnHeight)));
	}

	private getTargetScrollTop(el: HTMLElement, userEl: HTMLElement): number {
		const target = el.scrollTop + userEl.getBoundingClientRect().top - el.getBoundingClientRect().top;
		return Math.min(target, el.scrollHeight - el.clientHeight);
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
