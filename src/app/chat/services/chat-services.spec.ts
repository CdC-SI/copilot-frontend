import {TestBed} from '@angular/core/testing';
import {MatDialog} from '@angular/material/dialog';
import {TemplateRef} from '@angular/core';
import {of} from 'rxjs';
import {provideTranslateStub} from '../../../testing/angular';
import {IQuestion} from '../../shared/model/answer';
import {ChatMessage, ChatMessageSource} from '../../shared/model/chat-message';
import {UserStatus} from '../../shared/model/user';
import {AuthenticationServiceV2} from '../../shared/services/auth.service';
import {Command, CommandService} from '../../shared/services/command.service';
import {FaqItemsService} from '../../shared/services/faq-items.service';
import {ChatAutocompleteService} from './chat-autocomplete.service';
import {ChatSuggestionService} from './chat-suggestion.service';
import {UserAuthDialogService} from './user-auth-dialog.service';

const command: Command = {name: '/resume', description: 'd', example: 'e'};
const question = {id: 1, text: 'Âge de la retraite ?', answer: {text: '65 ans'}} as IQuestion;

describe('ChatAutocompleteService', () => {
	let service: ChatAutocompleteService;
	let faq: {search: jest.Mock};
	let commands: {searchCommands: jest.Mock};

	beforeEach(() => {
		faq = {search: jest.fn(() => of([question]))};
		commands = {searchCommands: jest.fn(() => of([command]))};
		TestBed.configureTestingModule({
			providers: [
				{provide: FaqItemsService, useValue: faq},
				{provide: CommandService, useValue: commands}
			]
		});
		service = TestBed.inject(ChatAutocompleteService);
	});

	it('cherche les commandes en mode commande', () => {
		service.getOptionService(true, true)('/res').subscribe();

		expect(commands.searchCommands).toHaveBeenCalledWith('/res');
	});

	it('cherche dans la FAQ au début d’une conversation', () => {
		let options: unknown[] = [];

		service
			.getOptionService(
				false,
				false
			)('retraite')
			.subscribe(result => (options = result));

		expect(faq.search).toHaveBeenCalledWith('retraite');
		expect(options).toEqual([question]);
	});

	it('ne propose rien dans une conversation en cours', () => {
		let options: unknown[] = ['?'];

		service
			.getOptionService(
				false,
				true
			)('retraite')
			.subscribe(result => (options = result));

		expect(options).toEqual([]);
		expect(faq.search).not.toHaveBeenCalled();
	});

	it('libelle et distingue commandes et questions', () => {
		expect(service.getOptionLabel(command, true)).toBe('/resume');
		expect(service.getOptionLabel(question, false)).toBe('Âge de la retraite ?');
		expect(service.getOptionLabel({} as IQuestion, false)).toBe('');
		expect(service.isCommand(command)).toBe(true);
		expect(service.isCommand(question)).toBe(false);
		expect(service.isFaqQuestion(question)).toBe(true);
		expect(service.isFaqQuestion(command)).toBe(false);
	});
});

describe('ChatSuggestionService', () => {
	let service: ChatSuggestionService;

	beforeEach(() => {
		TestBed.configureTestingModule({providers: [provideTranslateStub()]});
		service = TestBed.inject(ChatSuggestionService);
	});

	const llm = (message: string, suggestions?: string[]) => ({clientId: 'a', message, source: ChatMessageSource.LLM, suggestions}) as ChatMessage;

	it('ajoute puis efface les suggestions propres à la réponse', () => {
		service.addSpecificSuggestion('ii-salary');

		expect(service.suggestions()).toEqual([...service.getDefaultSuggestions(), {text: 'action_suggestions.ii-salary', action: 'ii-salary'}]);

		service.clearSpecificSuggestions();
		expect(service.getSpecificSuggestions()).toEqual([]);
	});

	it('reprend les suggestions du dernier message d’une conversation', () => {
		service.setSpecificSuggestionsFromMessages([llm('a', ['x']), llm('b', ['ii-salary'])]);
		expect(service.getSpecificSuggestions()).toEqual([{text: 'action_suggestions.ii-salary', action: 'ii-salary'}]);

		service.setSpecificSuggestionsFromMessages([llm('c')]);
		expect(service.getSpecificSuggestions()).toEqual([]);

		service.setSpecificSuggestionsFromMessages([]);
		expect(service.getSpecificSuggestions()).toEqual([]);
	});

	it('ouvre le formulaire de calcul AI prérempli depuis la dernière réponse', () => {
		const result = service.handleSuggestionAction('ii-salary', [llm('1. Année d’éligibilité : 2024\n2. Genre : MALE')]);

		expect(result.shouldShowForm).toBe(true);
		expect(result.formGroup.getRawValue()).toEqual(expect.objectContaining({yearOfEligibility: 2024, gender: 'MALE'}));
	});

	it('préremplit la saisie avec le préfixe traduit des autres actions', () => {
		expect(service.handleSuggestionAction('summary', [])).toEqual({shouldShowForm: false, searchValue: 'action_suggestions.prefixes.summary'});
	});
});

describe('UserAuthDialogService', () => {
	let service: UserAuthDialogService;
	let auth: {isRegistered: jest.Mock; userStatus: jest.Mock};
	let dialog: {open: jest.Mock};
	const [notRegistered, johnDoe, pending] = ['nr', 'jd', 'p'].map(name => ({name}) as unknown as TemplateRef<unknown>);

	beforeEach(() => {
		auth = {isRegistered: jest.fn(() => false), userStatus: jest.fn()};
		dialog = {open: jest.fn(template => ({template}))};
		TestBed.configureTestingModule({
			providers: [
				{provide: AuthenticationServiceV2, useValue: auth},
				{provide: MatDialog, useValue: dialog}
			]
		});
		service = TestBed.inject(UserAuthDialogService);
	});

	it.each([
		[UserStatus.GUEST, notRegistered],
		[UserStatus.JOHN_DOE, johnDoe],
		[UserStatus.PENDING_ACTIVATION, pending]
	])('ouvre le dialogue adapté au statut %s', (status, template) => {
		auth.userStatus.mockReturnValue(status);

		expect(service.showAuthDialog(notRegistered, johnDoe, pending)).toEqual({template});
	});

	it('n’ouvre rien pour un utilisateur actif', () => {
		auth.userStatus.mockReturnValue(UserStatus.ACTIVE);

		expect(service.showAuthDialog(notRegistered, johnDoe, pending)).toBeNull();
		expect(dialog.open).not.toHaveBeenCalled();
	});

	it('délègue l’état d’inscription', () => {
		auth.isRegistered.mockReturnValue(true);

		expect(service.isRegistered()).toBe(true);
	});
});
