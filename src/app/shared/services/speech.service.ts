import {Injectable} from '@angular/core';

@Injectable({
	providedIn: 'root'
})
export class SpeechService {
	private voices: SpeechSynthesisVoice[] = [];
	constructor() {
		speechSynthesis.getVoices();
		if (speechSynthesis.onvoiceschanged !== undefined) {
			speechSynthesis.onvoiceschanged = () => {
				this.populateVoices();
			};
		}
	}
	getVoice(lang: string) {
		return this.voices.find(voice => voice.lang.includes(lang));
	}
	private populateVoices() {
		this.voices = speechSynthesis.getVoices().filter(voice => {
			return ['de-CH', 'en-GB', 'fr-CH', 'it-IT'].includes(voice.lang);
		});
	}
}
