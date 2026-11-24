import {Component, input} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {MatDialog} from '@angular/material/dialog';
import {MatIcon} from '@angular/material/icon';
import {TranslateService, provideTranslateService} from '@ngx-translate/core';
import {Subject, of} from 'rxjs';
import {NotificationMock, notificationMock, provideNotificationMock} from '../../../../testing/angular';
import {aSource} from '../../../../testing/stream-events';
import {ChatMessage, ChatMessageSource} from '../../model/chat-message';
import {Feedback} from '../../model/feedback';
import {AuthenticationServiceV2} from '../../services/auth.service';
import {FaqItemsService} from '../../services/faq-items.service';
import {SpeechService} from '../../services/speech.service';
import {MessageActionComponent} from './message-action.component';

@Component({selector: 'mat-icon', template: ''})
class MatIconStubComponent {
	readonly svgIcon = input<string>();
}

describe('MessageActionComponent', () => {
	let fixture: ComponentFixture<MessageActionComponent>;
	let component: MessageActionComponent;
	let notif: NotificationMock;
	let dialogResult: unknown;
	let dialog: {open: jest.Mock};
	let faqItems: {add: jest.Mock};
	let speech: SpeechService;
	let expert: boolean;
	let synth: {cancel: jest.Mock; speak: jest.Mock};

	const answer: ChatMessage = {
		clientId: 'a',
		id: 'a1',
		message: 'L’âge de référence est de 65 ans [^1].',
		source: ChatMessageSource.LLM,
		timestamp: new Date(),
		url: 'https://example.org',
		lang: 'de',
		sources: [aSource({citation: 1, link: 'avs.pdf', pageNumber: '3'})]
	};
	const question: ChatMessage = {clientId: 'q', message: 'Âge de la retraite ?', faqItemId: 7, source: ChatMessageSource.USER, timestamp: new Date()};
	const findIcon = (name: string): HTMLElement =>
		fixture.debugElement.queryAll(d => d.componentInstance instanceof MatIconStubComponent && d.componentInstance.svgIcon() === name)[0]
			?.nativeElement as HTMLElement;
	const icon = findIcon;

	const render = (inputs: Partial<{regenerable: boolean}> = {}): void => {
		fixture = TestBed.createComponent(MessageActionComponent);
		component = fixture.componentInstance;
		fixture.componentRef.setInput('message', answer);
		fixture.componentRef.setInput('previousMessage', question);
		Object.entries(inputs).forEach(([key, value]) => fixture.componentRef.setInput(key, value));
		fixture.detectChanges();
	};

	beforeEach(() => {
		expert = false;
		dialogResult = true;
		notif = notificationMock();
		dialog = {open: jest.fn(() => ({afterClosed: () => of(dialogResult)}))};
		faqItems = {add: jest.fn(() => of({}))};
		synth = {cancel: jest.fn(), speak: jest.fn()};
		(globalThis as {speechSynthesis?: unknown}).speechSynthesis = synth;
		(globalThis as {SpeechSynthesisUtterance?: unknown}).SpeechSynthesisUtterance = class {
			text: string;
			onend: () => void;
		};
		TestBed.configureTestingModule({
			imports: [MessageActionComponent],
			providers: [
				provideTranslateService(),
				provideNotificationMock(notif),
				{provide: MatDialog, useValue: dialog},
				{provide: FaqItemsService, useValue: faqItems},
				{provide: AuthenticationServiceV2, useValue: {hasExpertRole: () => expert}},
				{provide: SpeechService, useValue: {speechStartEvent: new Subject<boolean>(), getVoice: jest.fn((): SpeechSynthesisVoice => null)}}
			]
		});
		TestBed.overrideComponent(MessageActionComponent, {remove: {imports: [MatIcon]}, add: {imports: [MatIconStubComponent]}});
		speech = TestBed.inject(SpeechService);
	});

	afterEach(() => {
		delete (globalThis as {speechSynthesis?: unknown}).speechSynthesis;
		delete (globalThis as {SpeechSynthesisUtterance?: unknown}).SpeechSynthesisUtterance;
	});

	it('propose l’édition de la FAQ aux experts et Régénérer sur la dernière réponse', () => {
		render();
		expect(findIcon('pencil')).toBeUndefined();
		expect(findIcon('refresh')).toBeUndefined();

		expert = true;
		render({regenerable: true});

		expect(findIcon('pencil')).toBeDefined();
		expect(findIcon('refresh')).toBeDefined();
	});

	it('Régénérer émet au clic et à la touche Entrée', () => {
		render({regenerable: true});
		const regenerate = jest.fn();
		component.regenerate.subscribe(regenerate);

		findIcon('refresh').click();
		findIcon('refresh').dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter'}));

		expect(regenerate).toHaveBeenCalledTimes(2);
	});

	describe('avis sur la réponse', () => {
		let feedbacks: Feedback[];

		beforeEach(() => {
			render();
			feedbacks = [];
			component.feedback.subscribe(feedback => feedbacks.push(feedback));
		});

		it('un avis positif émet le commentaire, sans catégorie', () => {
			icon('thumbs_up').click();
			component.feedbackFrmCtrl.setValue('Parfait');

			expect(component.feedBackTitle).toBe('feedback.positive');
			expect(component.isNegativeFeedback).toBe(false);
			expect(dialog.open).toHaveBeenCalledWith(component.feedbackDialog, {width: '500px'});
			expect(feedbacks).toEqual([
				{messageId: 'a1', question: 'Âge de la retraite ?', answer: answer.message, isPositive: true, comment: null, category: undefined}
			]);
		});

		it('un avis négatif propose « mauvaise réponse » par défaut et émet la catégorie choisie', () => {
			dialog.open.mockImplementation(() => {
				component.categoryFrmCtrl.setValue('INCOMPLETE_ANSWER');
				component.feedbackFrmCtrl.setValue('Il manque les rentes');
				return {afterClosed: () => of(true)};
			});

			icon('thumbs_down').click();

			expect(component.feedBackTitle).toBe('feedback.negative');
			expect(component.isNegativeFeedback).toBe(true);
			expect(feedbacks[0]).toEqual(expect.objectContaining({isPositive: false, comment: 'Il manque les rentes', category: 'INCOMPLETE_ANSWER'}));
		});

		it('un avis négatif sans catégorie n’en émet pas', () => {
			dialog.open.mockImplementation(() => {
				component.categoryFrmCtrl.setValue(null);
				return {afterClosed: () => of(true)};
			});

			component.openFeedbackDialog(false);

			expect(feedbacks[0].category).toBeUndefined();
		});

		it('rien n’est émis si le dialogue est annulé', () => {
			dialogResult = undefined;

			component.openFeedbackDialog(true);

			expect(feedbacks).toEqual([]);
		});
	});

	describe('édition de la FAQ', () => {
		beforeEach(() => {
			expert = true;
			render();
			TestBed.inject(TranslateService).use('fr');
		});

		it('pré-remplit la question et la réponse sans citations, puis enregistre', () => {
			findIcon('pencil').click();

			expect(component.faqItemFrmCtrl.value).toEqual({
				id: 7,
				text: 'Âge de la retraite ?',
				answer: 'L’âge de référence est de 65 ans.',
				url: 'https://example.org',
				language: 'fr'
			});
			expect(faqItems.add).toHaveBeenCalledWith(component.faqItemFrmCtrl.value);
			expect(notif.success).toHaveBeenCalledWith('edit.item.success');
		});

		it('n’enregistre rien si le dialogue est annulé', () => {
			dialogResult = false;

			component.openFaqItemDialog();

			expect(faqItems.add).not.toHaveBeenCalled();
		});
	});

	describe('lecture à voix haute', () => {
		beforeEach(() => render());

		it('lit la réponse sans citations dans la langue du message, puis s’arrête à la fin', () => {
			const started = jest.fn();
			speech.speechStartEvent.subscribe(started);

			icon('volume_high').click();
			fixture.detectChanges();

			const utterance = synth.speak.mock.calls[0][0] as SpeechSynthesisUtterance;
			expect(utterance.text).toBe('L’âge de référence est de 65 ans.');
			expect(utterance.rate).toBe(1.5);
			expect(speech.getVoice).toHaveBeenCalledWith('de');
			expect(started).toHaveBeenCalledWith(true);
			expect(component.beingSpoken()).toBe(true);
			expect(findIcon('volume_muted').classList).toContain('being-spoken');

			utterance.onend(new Event('end') as SpeechSynthesisEvent);
			expect(component.beingSpoken()).toBe(false);
		});

		it('utilise la langue courante quand le message n’en a pas', () => {
			fixture.componentRef.setInput('message', {...answer, lang: undefined});
			TestBed.inject(TranslateService).use('it');

			component.speak();

			expect(speech.getVoice).toHaveBeenCalledWith('it');
		});

		it('un second clic arrête la lecture', () => {
			component.speak();
			component.speak();

			expect(synth.cancel).toHaveBeenCalledTimes(2);
			expect(synth.speak).toHaveBeenCalledTimes(1);
			expect(component.beingSpoken()).toBe(false);
		});

		it('une autre lecture interrompt celle-ci', () => {
			component.speak();

			speech.speechStartEvent.next(true);

			expect(component.beingSpoken()).toBe(false);
		});
	});

	describe('copie de la réponse', () => {
		let writeText: jest.Mock;

		beforeEach(() => {
			render();
			writeText = jest.fn(() => Promise.resolve());
			Object.defineProperty(navigator, 'clipboard', {configurable: true, value: {writeText}});
		});

		afterEach(() => {
			delete (navigator as {clipboard?: unknown}).clipboard;
		});

		it('copie le texte avec la liste des sources citées', async () => {
			icon('copy').click();
			await Promise.resolve();

			const text = writeText.mock.calls[0][0] as string;
			expect(text).toContain('L’âge de référence est de 65 ans [1].');
			expect(text).toContain('chat.answer.copy.sources');
			expect(text).toContain('sourceList.meta.page 3');
			expect(notif.success).toHaveBeenCalledWith('copilot.answer.copied');
		});

		it('signale l’échec de la copie', async () => {
			writeText.mockReturnValue(Promise.reject(new Error('refus')));

			component.copyAnswer();
			await new Promise(resolve => setTimeout(resolve));

			expect(notif.error).toHaveBeenCalledWith('i18n.oblique.http.error.general');
		});

		it('signale un presse-papiers indisponible', () => {
			Object.defineProperty(navigator, 'clipboard', {configurable: true, value: undefined});

			component.copyAnswer();

			expect(notif.error).toHaveBeenCalledWith('i18n.oblique.http.error.general');
		});
	});
});
