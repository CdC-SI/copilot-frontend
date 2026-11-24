import {TestBed} from '@angular/core/testing';
import {BehaviorSubject, of} from 'rxjs';
import {aUser} from '../../../testing/fixtures';
import {SettingsType} from '../model/settings';
import {IUser} from '../model/user';
import {AuthenticationServiceV2} from './auth.service';
import {CommandService} from './command.service';
import {SettingsService} from './settings.service';

describe('CommandService', () => {
	let service: CommandService;
	let user$: BehaviorSubject<IUser>;
	let settings: {getSettings: jest.Mock};

	beforeEach(() => {
		user$ = new BehaviorSubject<IUser>(null);
		settings = {getSettings: jest.fn(() => of(['/resume', '/Traduire']))};
		TestBed.configureTestingModule({
			providers: [
				{provide: AuthenticationServiceV2, useValue: {$authenticatedUser: user$}},
				{provide: SettingsService, useValue: settings}
			]
		});
		service = TestBed.inject(CommandService);
	});

	it('ne charge les commandes autorisées qu’une fois l’utilisateur connu', () => {
		expect(settings.getSettings).not.toHaveBeenCalled();

		user$.next(aUser());

		expect(settings.getSettings).toHaveBeenCalledWith(SettingsType.AUTHORIZED_COMMANDS);
	});

	it('cherche parmi les commandes autorisées, sans tenir compte de la casse', () => {
		user$.next(aUser());
		let found: string[] = [];

		service.searchCommands('/TRAD').subscribe(commands => (found = commands.map(c => c.name)));

		expect(found).toEqual(['/Traduire']);
	});

	it('décrit chaque commande', () => {
		user$.next(aUser());
		let first: unknown;

		service.searchCommands('/').subscribe(commands => (first = commands[0]));

		expect(first).toEqual({name: '/resume', description: 'Execute /resume command', example: '/resume <text>'});
	});

	it('ne propose rien hors du mode commande', () => {
		user$.next(aUser());
		let found: unknown[] = ['?'];

		service.searchCommands('resume').subscribe(commands => (found = commands));

		expect(found).toEqual([]);
	});

	it('analyse une commande et ses arguments', () => {
		expect(service.isCommand('/resume texte')).toBe(true);
		expect(service.parseCommand('/resume  un  texte ')).toEqual({command: '/resume', args: 'un  texte'});
		expect(service.parseCommand('/resume')).toEqual({command: '/resume', args: ''});
		expect(service.parseCommand('question')).toBeNull();
	});
});
