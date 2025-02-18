import {Component, OnInit} from '@angular/core';

@Component({
	selector: 'zco-question-suggestion',
	templateUrl: './question-suggestion.component.html',
	styleUrl: './question-suggestion.component.scss'
})
export class QuestionSuggestionComponent implements OnInit {
	sentences: string[] = [
		'Wann finden die nächsten kantonalen Abstimmungen oder Wahlen statt?',
		'Was ist E-Voting?',
		'Wer kann ein fakultatives Referendum unterschreiben?',
		'Wer kann eine Initiative unterschreiben?',
		'Wann kann man abstimmen?',
	];

	currentSentence: string = '';
	displayedText: string = '';
	speed: number = 50;
	index: number = 0;
	typingCompleted: boolean = false;

	ngOnInit(): void {
		this.showRandomSentence();
	}

	showRandomSentence(): void {
		const randomIndex = Math.floor(Math.random() * this.sentences.length);
		this.currentSentence = this.sentences[randomIndex];
		this.displayedText = '';
		this.index = 0;
		this.typingCompleted = false;
		this.typeEffect();
	}

	typeEffect(): void {
		if (this.index < this.currentSentence.length) {
			this.displayedText += this.currentSentence.charAt(this.index);
			this.index++;
			setTimeout(() => this.typeEffect(), this.speed); // Continue typing
		} else {
			this.typingCompleted = true;
			setTimeout(() => this.clearAndShowNextSentence(), 2000);
		}
	}

	clearAndShowNextSentence(): void {
		this.typingCompleted = false;
		this.displayedText = '';
		this.showRandomSentence();
	}
}
