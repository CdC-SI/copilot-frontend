import {TestBed} from '@angular/core/testing';
import {SettingsEventService} from './settings-event.service';
import {SpeechService} from './speech.service';

describe('SpeechService', () => {
	const voice = (lang: string) => ({lang}) as SpeechSynthesisVoice;
	let synthesis: {getVoices: jest.Mock; onvoiceschanged: (() => void) | null | undefined};

	beforeEach(() => {
		synthesis = {getVoices: jest.fn(() => [voice('fr-CH'), voice('fr-FR'), voice('de-CH'), voice('it-IT')]), onvoiceschanged: null};
		Object.defineProperty(globalThis, 'speechSynthesis', {value: synthesis, configurable: true});
	});

	afterEach(() => {
		delete (globalThis as {speechSynthesis?: unknown}).speechSynthesis;
	});

	it('retient les voix suisses et italienne une fois la liste chargée', () => {
		const service = TestBed.inject(SpeechService);
		expect(service.getVoice('fr')).toBeUndefined();

		synthesis.onvoiceschanged();

		expect(service.getVoice('fr')).toEqual(voice('fr-CH'));
		expect(service.getVoice('it')).toEqual(voice('it-IT'));
		expect(service.getVoice('en')).toBeUndefined();
	});

	it('ne s’abonne pas aux changements quand le navigateur ne les signale pas', () => {
		synthesis.onvoiceschanged = undefined;

		TestBed.inject(SpeechService);

		expect(synthesis.onvoiceschanged).toBeUndefined();
	});
});

describe('SettingsEventService', () => {
	it('signale qu’un rafraîchissement des paramètres est nécessaire', () => {
		const service = TestBed.inject(SettingsEventService);
		const listener = jest.fn();
		service.settingsNeedRefresh.subscribe(listener);

		service.emitSettingsRefresh();

		expect(listener).toHaveBeenCalledTimes(1);
	});
});
