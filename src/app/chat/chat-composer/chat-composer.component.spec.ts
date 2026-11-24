import {Component, EventEmitter, Input, Output, signal} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {FormControl, FormGroup} from '@angular/forms';
import {MatIcon} from '@angular/material/icon';
import {By} from '@angular/platform-browser';
import {provideTranslateService} from '@ngx-translate/core';
import {ObButtonDirective, ObIconButtonDirective} from '@oblique/oblique';
import {Subject, of} from 'rxjs';
import {ActionSuggestionsComponent} from '../../shared/components/action-suggestions/action-suggestions.component';
import {AutocompleteInputComponent} from '../../shared/components/autocomplete-input/autocomplete-input.component';
import {DynamicFormComponent} from '../../shared/components/dynamic-form/dynamic-form.component';
import {ChatStore} from '../chat.store';
import {ChatAttachmentsComponent} from './chat-attachments/chat-attachments.component';
import {ChatComposerComponent} from './chat-composer.component';

@Component({selector: 'mat-icon', template: ''})
class MatIconStubComponent {
	@Input() svgIcon: string;
}

@Component({selector: 'zco-dynamic-form', template: ''})
class DynamicFormStubComponent {
	@Input() def: unknown;
	@Input() form: FormGroup;
	@Output() readonly submitted = new EventEmitter<void>();
	@Output() readonly closeForm = new EventEmitter<void>();
}

@Component({selector: 'zco-action-suggestions', template: ''})
class ActionSuggestionsStubComponent {
	@Input() suggestions: unknown[];
	@Output() readonly actionSelected = new EventEmitter<string>();
}

@Component({selector: 'zco-chat-attachments', template: ''})
class ChatAttachmentsStubComponent {}

describe('ChatComposerComponent', () => {
	let fixture: ComponentFixture<ChatComposerComponent>;
	let store: ReturnType<typeof createStore>;

	const createStore = () => ({
		activeForm: signal<{def: unknown; group: FormGroup} | null>(null),
		isRegistered: signal(true),
		suggestions: signal([{text: 'Calculer', action: 'calc'}]),
		isGenerating: signal(false),
		isStopping: signal(false),
		canSend: signal(true),
		optionService: signal(() => of([])),
		searchCtrl: new FormControl(''),
		focusRequests: new Subject<void>(),
		optionLabel: jest.fn((option: {label: string}) => option.label),
		submitForm: jest.fn(),
		closeForm: jest.fn(),
		handleSuggestionAction: jest.fn(),
		selectOption: jest.fn(),
		setCommandMode: jest.fn(),
		addAttachments: jest.fn(),
		send: jest.fn(),
		stopGeneration: jest.fn()
	});
	const el = (): HTMLElement => fixture.nativeElement;
	const action = (): HTMLButtonElement => el().querySelector('.composer-action');
	const child = <T>(type: new (...args: never[]) => T): T => fixture.debugElement.query(By.directive(type))?.componentInstance as T;
	const autocomplete = (): AutocompleteInputComponent<unknown> => child(AutocompleteInputComponent);
	const input = (): HTMLTextAreaElement => el().querySelector('ut-autocomplete-input textarea');

	beforeEach(() => {
		jest.useFakeTimers();
		store = createStore();
		TestBed.configureTestingModule({imports: [ChatComposerComponent], providers: [provideTranslateService(), {provide: ChatStore, useValue: store}]});
		// Oblique (`obButton`) observe `aria-describedby` et plante quand l'info-bulle le retire : retiré, sans incidence ici.
		TestBed.overrideComponent(ChatComposerComponent, {
			remove: {imports: [MatIcon, ObButtonDirective, ObIconButtonDirective, DynamicFormComponent, ActionSuggestionsComponent, ChatAttachmentsComponent]},
			add: {imports: [MatIconStubComponent, DynamicFormStubComponent, ActionSuggestionsStubComponent, ChatAttachmentsStubComponent]}
		});
		TestBed.overrideComponent(AutocompleteInputComponent, {remove: {imports: [MatIcon]}, add: {imports: [MatIconStubComponent]}});
		fixture = TestBed.createComponent(ChatComposerComponent);
		fixture.detectChanges();
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it('donne le focus à la saisie au premier rendu', () => {
		jest.runOnlyPendingTimers();

		expect(document.activeElement).toBe(input());
	});

	it('ne vole pas le focus d’un autre champ', () => {
		const other = document.body.appendChild(document.createElement('textarea'));
		other.focus();

		store.focusRequests.next();
		jest.runOnlyPendingTimers();

		expect(document.activeElement).toBe(other);
		other.remove();
	});

	it('reprend le focus à la fin de la réponse', () => {
		jest.runOnlyPendingTimers();
		input().blur();
		store.isGenerating.set(true);
		fixture.detectChanges();
		jest.runOnlyPendingTimers();
		expect(document.activeElement).not.toBe(input());

		store.isGenerating.set(false);
		fixture.detectChanges();
		jest.runOnlyPendingTimers();

		expect(document.activeElement).toBe(input());
	});

	it('envoie la question et relaie les événements de la saisie', () => {
		action().click();
		autocomplete().optionSelected.emit({label: 'FAQ'});
		autocomplete().inputChange.emit('/cmd');
		const files = [new File(['x'], 'a.pdf')];
		autocomplete().attachmentsSelected.emit(files);
		autocomplete().submitMessage.emit();

		expect(action().type).toBe('submit');
		expect(store.send).toHaveBeenCalledTimes(2);
		expect(store.selectOption).toHaveBeenCalledWith({label: 'FAQ'});
		expect(store.setCommandMode).toHaveBeenCalledWith('/cmd');
		expect(store.addAttachments).toHaveBeenCalledWith(files);
		expect(autocomplete().optionLabelFn({label: 'Option'})).toBe('Option');
	});

	it('désactive l’envoi quand la question n’est pas envoyable', () => {
		store.canSend.set(false);
		fixture.detectChanges();

		expect(action().disabled).toBe(true);
	});

	it('remplace l’envoi par Stop pendant la génération, désactivé pendant l’arrêt', () => {
		store.isGenerating.set(true);
		fixture.detectChanges();

		action().click();
		expect(action().type).toBe('button');
		expect(action().getAttribute('aria-label')).toBe('chat.generation.stop');
		expect(store.stopGeneration).toHaveBeenCalled();

		store.isStopping.set(true);
		fixture.detectChanges();
		expect(action().disabled).toBe(true);
		expect(action().getAttribute('aria-label')).toBe('chat.generation.stopping');
	});

	it('propose les suggestions aux utilisateurs inscrits', () => {
		child(ActionSuggestionsStubComponent).actionSelected.emit('calc');
		expect(store.handleSuggestionAction).toHaveBeenCalledWith('calc');
		expect(child(ActionSuggestionsStubComponent).suggestions).toEqual([{text: 'Calculer', action: 'calc'}]);

		store.isRegistered.set(false);
		fixture.detectChanges();
		expect(child(ActionSuggestionsStubComponent)).toBeUndefined();
	});

	it('un formulaire dynamique remplace la saisie et les suggestions, pièces jointes conservées', () => {
		const group = new FormGroup({});
		store.activeForm.set({def: {title: 'Form'}, group});
		fixture.detectChanges();

		const form = child(DynamicFormStubComponent);
		form.submitted.emit();
		form.closeForm.emit();

		expect(form.form).toBe(group);
		expect(store.submitForm).toHaveBeenCalled();
		expect(store.closeForm).toHaveBeenCalled();
		expect(autocomplete()).toBeUndefined();
		expect(child(ActionSuggestionsStubComponent)).toBeUndefined();
		expect(child(ChatAttachmentsStubComponent)).toBeDefined();
	});
});
