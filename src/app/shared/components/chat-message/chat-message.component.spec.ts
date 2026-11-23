import {ElementRef, Injector, runInInjectionContext} from '@angular/core';
import {ChatMessageComponent} from './chat-message.component';
import {ChatMessageSource} from '../../model/chat-message';

const createComponent = (offsetWidth: number): ChatMessageComponent =>
	runInInjectionContext(Injector.create({providers: [{provide: ElementRef, useValue: {nativeElement: {offsetWidth}}}]}), () => new ChatMessageComponent());

describe('ChatMessageComponent (modification de la question)', () => {
	let component: ChatMessageComponent;
	let emitted: string[];

	beforeEach(() => {
		component = createComponent(320);
		component.message = {clientId: 'c1', message: 'Question initiale', source: ChatMessageSource.USER, timestamp: new Date()};
		component.replayable = true;
		emitted = [];
		component.editQuestion.subscribe(q => emitted.push(q));
	});

	it('pré-remplit le formulaire avec la question, à la largeur de la bulle', () => {
		component.startEdit();
		expect(component.editing).toBe(true);
		expect(component.editedQuestion).toBe('Question initiale');
		expect(component.editWidth).toBe(320);
	});

	it('impose une largeur minimale pour une question courte', () => {
		component = createComponent(40);
		component.message = {clientId: 'c1', message: 'Oui', source: ChatMessageSource.USER, timestamp: new Date()};
		component.replayable = true;
		component.startEdit();
		expect(component.editWidth).toBe(240);
	});

	it('expose la génération en cours et la barre d’actions selon l’état de la réponse', () => {
		component.message = {clientId: 'c1', message: '', source: ChatMessageSource.LLM, timestamp: new Date(), isCompleted: false};
		expect(component.isGenerating).toBe(true);
		expect(component.showActions).toBe(false);

		Object.assign(component.message, {isCompleted: true, interrupted: true});
		expect(component.isGenerating).toBe(false);
		expect(component.showActions).toBe(false);

		component.message.id = 'm-1';
		expect(component.showActions).toBe(true);
	});

	it('n’anime le statut d’avancement que pendant la génération', () => {
		component.message = {clientId: 'c1', message: 'Recherche…', status: 'searching', source: ChatMessageSource.LLM, timestamp: new Date(), isCompleted: false};
		expect(component.showsProgressStatus).toBe(true);

		// Flux interrompu en erreur : le statut est conservé mais la réponse est terminée.
		Object.assign(component.message, {isCompleted: true, inError: true});
		expect(component.showsProgressStatus).toBe(false);
	});

	it('émet la question modifiée, sans espaces superflus', () => {
		component.startEdit();
		component.editedQuestion = '  Nouvelle question  ';
		component.submitEdit();
		expect(emitted).toEqual(['Nouvelle question']);
		expect(component.editing).toBe(false);
	});

	it("n'émet rien si la question est vide ou inchangée", () => {
		component.startEdit();
		component.editedQuestion = '   ';
		component.submitEdit();
		expect(component.editing).toBe(true);

		component.editedQuestion = 'Question initiale';
		component.submitEdit();
		expect(emitted).toEqual([]);
		expect(component.editing).toBe(false);
	});

	it("l'annulation ferme le formulaire sans émettre", () => {
		component.startEdit();
		component.cancelEdit();
		expect(component.editing).toBe(false);
		expect(emitted).toEqual([]);
	});

	it('soumet avec Entrée, mais conserve les retours à la ligne avec Maj+Entrée', () => {
		component.startEdit();
		component.editedQuestion = 'Question envoyée';
		const enterEvent = {shiftKey: false, preventDefault: jest.fn()} as unknown as KeyboardEvent;
		component.submitEditOnEnter(enterEvent);
		expect(enterEvent.preventDefault).toHaveBeenCalled();
		expect(emitted).toEqual(['Question envoyée']);

		component.startEdit();
		const shiftEnterEvent = {shiftKey: true, preventDefault: jest.fn()} as unknown as KeyboardEvent;
		component.submitEditOnEnter(shiftEnterEvent);
		expect(shiftEnterEvent.preventDefault).not.toHaveBeenCalled();
		expect(component.editing).toBe(true);
	});

	it("n'émet pas si le message n'est plus rejouable", () => {
		component.startEdit();
		component.replayable = false;
		component.editedQuestion = 'Ancienne question';
		component.submitEdit();
		expect(emitted).toEqual([]);
		expect(component.editing).toBe(true);
	});
});

describe('ChatMessageComponent (citations)', () => {
	it('un clic sur une pastille ouvre les sources et met la source citée en évidence', () => {
		jest.useFakeTimers();
		const card = {scrollIntoView: jest.fn(), focus: jest.fn()};
		const querySelector = jest.fn().mockReturnValue(card);
		const component = runInInjectionContext(
			Injector.create({providers: [{provide: ElementRef, useValue: {nativeElement: {querySelector}}}]}),
			() => new ChatMessageComponent()
		);

		component.showCitedSource(2);
		expect(component.sourcePanelOpen).toBe(true);
		expect(component.highlightedCitation).toBe(2);

		jest.runAllTimers();
		expect(querySelector).toHaveBeenCalledWith('[data-citation-source="2"]');
		expect(card.focus).toHaveBeenCalledWith({preventScroll: true});
		expect(card.scrollIntoView).toHaveBeenCalled();
		jest.useRealTimers();
	});
});
