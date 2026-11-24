import {Component, input, output, signal} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {FormControl} from '@angular/forms';
import {MatIcon} from '@angular/material/icon';
import {provideTranslateService} from '@ngx-translate/core';
import {Subject} from 'rxjs';
import {ChatMessageComponent} from '../../shared/components/chat-message/chat-message.component';
import {ChatMessage, ChatMessageSource} from '../../shared/model/chat-message';
import {ChatScrollRequest} from '../chat.models';
import {ChatStore} from '../chat.store';
import {ChatTimelineComponent} from './chat-timeline.component';

@Component({selector: 'zco-chat-message', template: '{{ message().message }}'})
class ChatMessageStubComponent {
	readonly conversationId = input<string | null>();
	readonly message = input.required<ChatMessage>();
	readonly previousMessage = input<ChatMessage | null>();
	readonly replayable = input<boolean>();
	readonly feedback = output<unknown>();
	readonly workspaceChange = output<string>();
	readonly regenerate = output<void>();
	readonly editQuestion = output<string>();
	readonly stop = output<void>();
	readonly toolApproval = output<boolean>();
}

@Component({selector: 'mat-icon', template: ''})
class MatIconStubComponent {
	readonly svgIcon = input<string>();
}

/** Géométrie simulée (jsdom ne calcule pas la mise en page). */
function layout(el: HTMLElement, geometry: Partial<Record<'offsetTop' | 'offsetHeight' | 'clientHeight' | 'scrollHeight' | 'top', number>>): void {
	for (const key of ['offsetTop', 'offsetHeight', 'clientHeight', 'scrollHeight'] as const) {
		if (geometry[key] !== undefined) Object.defineProperty(el, key, {configurable: true, value: geometry[key]});
	}
	if (geometry.top !== undefined) el.getBoundingClientRect = () => ({top: geometry.top}) as DOMRect;
}

describe('ChatTimelineComponent', () => {
	let fixture: ComponentFixture<ChatTimelineComponent>;
	let component: ChatTimelineComponent;
	let store: ReturnType<typeof createStore>;
	let resizeCallbacks: (() => void)[];
	let observed: Element[];
	let disconnect: jest.Mock;

	const createStore = () => ({
		messages: signal<ChatMessage[]>([]),
		userFirstName: signal<string | null>(null),
		currentConversation: signal<{conversationId: string} | null>({conversationId: 'c1'}),
		scrollRequests: new Subject<ChatScrollRequest>(),
		focusRequests: new Subject<void>(),
		searchCtrl: new FormControl(''),
		closeForm: jest.fn(),
		sendFeedback: jest.fn(),
		changeWorkspace: jest.fn(),
		isReplayable: jest.fn(() => false),
		regenerateLastAnswer: jest.fn(),
		editLastQuestion: jest.fn(),
		stopGeneration: jest.fn(),
		decideToolApproval: jest.fn()
	});
	const msg = (clientId: string, source: ChatMessageSource, extra: Partial<ChatMessage> = {}): ChatMessage => ({
		clientId,
		source,
		message: clientId,
		timestamp: new Date(),
		isCompleted: true,
		...extra
	});
	const el = (): HTMLElement => fixture.nativeElement;
	const container = (): HTMLElement => el().querySelector('.message-container');
	const messageEls = (): HTMLElement[] => Array.from(el().querySelectorAll<HTMLElement>('.message'));
	const spacerHeight = (): string => el().querySelector<HTMLElement>('.message-bottom-spacer').style.height;

	beforeAll(() => {
		(globalThis as {ResizeObserver?: unknown}).ResizeObserver = class {
			constructor(callback: () => void) {
				resizeCallbacks.push(callback);
			}
			observe(target: Element): void {
				observed.push(target);
			}
			disconnect(): void {
				disconnect();
				observed = [];
			}
		};
	});

	afterAll(() => {
		delete (globalThis as {ResizeObserver?: unknown}).ResizeObserver;
	});

	beforeEach(() => {
		jest.useFakeTimers();
		resizeCallbacks = [];
		observed = [];
		disconnect = jest.fn();
		store = createStore();
		TestBed.configureTestingModule({imports: [ChatTimelineComponent], providers: [provideTranslateService(), {provide: ChatStore, useValue: store}]});
		TestBed.overrideComponent(ChatTimelineComponent, {
			remove: {imports: [ChatMessageComponent, MatIcon]},
			add: {imports: [ChatMessageStubComponent, MatIconStubComponent]}
		});
		fixture = TestBed.createComponent(ChatTimelineComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	describe('état vide', () => {
		it('salue l’utilisateur par son prénom, ou de façon anonyme', () => {
			expect(el().querySelector('.empty-greeting').textContent.trim()).toBe('chat.empty.greeting.anonymous');

			store.userFirstName.set('Ada');
			fixture.detectChanges();

			expect(el().querySelector('.empty-greeting').textContent.trim()).toBe('chat.empty.greeting');
		});

		it('un exemple pré-remplit la saisie sans l’envoyer, après avoir fermé un formulaire ouvert', () => {
			const focus = jest.fn();
			store.focusRequests.subscribe(focus);
			const chips = el().querySelectorAll<HTMLButtonElement>('.example-chip');

			chips[1].click();

			expect(chips).toHaveLength(4);
			expect(store.closeForm).toHaveBeenCalled();
			expect(store.searchCtrl.value).toBe('chat.empty.example.2');
			expect(focus).toHaveBeenCalledTimes(1);
		});
	});

	describe('messages', () => {
		beforeEach(() => {
			store.messages.set([msg('q1', ChatMessageSource.USER), msg('a1', ChatMessageSource.LLM, {isCompleted: false})]);
			fixture.detectChanges();
		});

		it('affiche les messages à la place de l’état vide, avec l’avatar clignotant pendant la génération', () => {
			expect(el().querySelector('.empty-state')).toBeNull();
			expect(messageEls().map(m => /user|assistant/.exec(m.className)[0])).toEqual(['user', 'assistant']);
			const avatars = el().querySelectorAll<HTMLImageElement>('.ia-avatar');
			expect(avatars[0].hidden).toBe(true);
			expect(avatars[1].classList).toContain('blink');
		});

		it('transmet au message la conversation, le message précédent et l’état rejouable', () => {
			const stubs = fixture.debugElement
				.queryAll(d => d.componentInstance instanceof ChatMessageStubComponent)
				.map(d => d.componentInstance as ChatMessageStubComponent);

			expect(stubs[0].previousMessage()).toBeNull();
			expect(stubs[1].previousMessage().clientId).toBe('q1');
			expect(stubs[1].conversationId()).toBe('c1');
			expect(store.isReplayable).toHaveBeenCalled();
		});

		it('relaie les actions du message vers le store', () => {
			const stub = fixture.debugElement.queryAll(d => d.componentInstance instanceof ChatMessageStubComponent)[1].componentInstance as ChatMessageStubComponent;

			stub.feedback.emit({vote: 'up'});
			stub.workspaceChange.emit('ws');
			stub.regenerate.emit();
			stub.editQuestion.emit('Nouvelle question');
			stub.stop.emit();
			stub.toolApproval.emit(true);

			expect(store.sendFeedback).toHaveBeenCalledWith({vote: 'up'});
			expect(store.changeWorkspace).toHaveBeenCalledWith('ws');
			expect(store.regenerateLastAnswer).toHaveBeenCalled();
			expect(store.editLastQuestion).toHaveBeenCalledWith('Nouvelle question');
			expect(store.stopGeneration).toHaveBeenCalled();
			expect(store.decideToolApproval).toHaveBeenCalledWith(expect.objectContaining({clientId: 'a1'}), true);
		});

		it('passe une conversation absente comme null', () => {
			store.currentConversation.set(null);
			fixture.detectChanges();
			const stub = fixture.debugElement.queryAll(d => d.componentInstance instanceof ChatMessageStubComponent)[0].componentInstance as ChatMessageStubComponent;

			expect(stub.conversationId()).toBeNull();
		});
	});

	describe('défilement', () => {
		let scrollTo: jest.Mock;

		const renderTurn = (): void => {
			store.messages.set([
				msg('q1', ChatMessageSource.USER),
				msg('a1', ChatMessageSource.LLM),
				msg('q2', ChatMessageSource.USER),
				msg('a2', ChatMessageSource.LLM)
			]);
			fixture.detectChanges();
			const [, , q2, a2] = messageEls();
			layout(container(), {clientHeight: 500, scrollHeight: 2000, top: 100});
			layout(q2, {offsetTop: 1000, offsetHeight: 50, top: 400});
			layout(a2, {offsetTop: 1050, offsetHeight: 150});
			scrollTo = jest.fn();
			container().scrollTo = scrollTo;
		};

		it('amène la dernière question en haut du fil et réserve l’espace nécessaire sous le dernier tour', () => {
			renderTurn();
			container().scrollTop = 200;

			store.scrollRequests.next('last-user');
			fixture.detectChanges();
			jest.runAllTimers();

			// Tour de 200 px dans un fil de 500 px : 300 px d'espace ; cible 200 + (400 - 100).
			expect(spacerHeight()).toBe('300px');
			expect(scrollTo).toHaveBeenCalledWith({top: 500, behavior: 'smooth'});
		});

		it('borne la cible au défilement maximal', () => {
			renderTurn();
			layout(container(), {clientHeight: 500, scrollHeight: 600, top: 100});

			store.scrollRequests.next('opened');
			jest.runAllTimers();

			expect(scrollTo).toHaveBeenCalledWith({top: 100, behavior: 'smooth'});
		});

		it('n’ajoute pas d’espace pour une conversation ouverte ni quand le tour remplit le fil', () => {
			renderTurn();
			store.scrollRequests.next('opened');
			fixture.detectChanges();
			expect(spacerHeight()).toBe('0px');

			layout(messageEls()[3], {offsetTop: 1050, offsetHeight: 900});
			store.scrollRequests.next('last-user');
			fixture.detectChanges();
			expect(spacerHeight()).toBe('0px');
		});

		it('recalcule l’espace quand le dernier tour change de taille', () => {
			renderTurn();
			store.scrollRequests.next('last-user');
			layout(messageEls()[3], {offsetTop: 1050, offsetHeight: 350});

			resizeCallbacks.forEach(callback => callback());
			fixture.detectChanges();

			expect(spacerHeight()).toBe('100px');
		});

		it('observe le fil et les messages du dernier tour seulement', () => {
			renderTurn();
			TestBed.tick();

			const [, , q2, a2] = messageEls();
			expect(observed).toEqual([container(), q2, a2]);
		});

		it('remet le fil en haut et masque le bouton sur « reset »', () => {
			renderTurn();
			container().scrollTop = 300;
			component.showScrollToLastMessage.set(true);

			store.scrollRequests.next('reset');

			expect(container().scrollTop).toBe(0);
			expect(component.showScrollToLastMessage()).toBe(false);
		});

		it('remet le fil en haut quand il n’y a pas de question à atteindre', () => {
			store.messages.set([msg('a1', ChatMessageSource.FAQ)]);
			fixture.detectChanges();
			container().scrollTop = 300;

			store.scrollRequests.next('last-user');
			jest.runAllTimers();

			expect(container().scrollTop).toBe(0);
		});

		describe('bouton « dernière question »', () => {
			let frames: FrameRequestCallback[];

			beforeEach(() => {
				frames = [];
				jest.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => frames.push(callback));
				renderTurn();
			});

			const flushFrames = (): void => {
				frames.splice(0).forEach(frame => frame(0));
				fixture.detectChanges();
			};
			const button = (): HTMLButtonElement => el().querySelector('.scroll-to-bottom');

			it('apparaît quand on remonte au-dessus de la dernière question, une seule mesure par image', () => {
				container().scrollTop = 0;

				container().dispatchEvent(new Event('scroll'));
				const queued = frames.length;
				store.scrollRequests.next('visibility');
				expect(frames).toHaveLength(queued);
				flushFrames();

				expect(button()).not.toBeNull();
			});

			it('reste masqué près de la dernière question', () => {
				container().scrollTop = 295;
				layout(messageEls()[2], {top: 100});

				container().dispatchEvent(new Event('scroll'));
				flushFrames();

				expect(button()).toBeNull();
			});

			it('ramène à la dernière question et disparaît au clic', () => {
				container().dispatchEvent(new Event('scroll'));
				flushFrames();

				button().click();
				jest.runAllTimers();
				fixture.detectChanges();

				expect(scrollTo).toHaveBeenCalledWith({top: 300, behavior: 'smooth'});
				expect(button()).toBeNull();
			});
		});
	});

	it('déconnecte l’observateur à la destruction', () => {
		fixture.destroy();

		expect(disconnect).toHaveBeenCalled();
	});
});
