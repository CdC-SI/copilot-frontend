import {ChangeDetectionStrategy, Component, OnDestroy, OnInit, signal} from '@angular/core';

@Component({
	selector: 'zco-question-suggestion',
	templateUrl: './question-suggestion.component.html',
	styleUrl: './question-suggestion.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class QuestionSuggestionComponent implements OnInit, OnDestroy {
	sentences: string[] = [
		'Jusqu’à quand dois-je payer des cotisations AVS ?',
		'Comment l’âge de la retraite des femmes est-il relevé ?',
		'Que puis-je faire si ma rente AI ne me suffit pas pour vivre ?',
		'Peut-on utiliser la fortune de 50 milliards pour financer la 13e rente AVS ?',
		'Wann endet meine AHV-Beitragspflicht?',
		'Was bedeutet «im Sinne der AHV dauerhaft voll erwerbstätig»?',
		'Wem und wann wird die Mutterschaftsentschädigung ausgezahlt?',
		'Ab wann erhalte ich die Betreuungsentschädigung und wie lange?',
		'Bis zu welchem Höchstbetrag werden Krankheits- und Behinderungskosten vergütet?',
		'Quando sono considerato/a datore di lavoro per l’AVS?',
		'A partire da quando è versata l’indennità di maternità e per quanto tempo?',
		'A quanto ammonta l’indennità di assistenza?',
		'Sugli assegni familiari vanno pagati i contributi sociali?',
		'Sono divorziato/a / Sono separato/a e vivo con i miei figli: a chi spettano gli assegni familiari?'
	];

	currentSentence: string = '';
	readonly displayedText = signal('');
	speed: number = 50;
	index: number = 0;
	readonly typingCompleted = signal(false);
	private timeoutId?: ReturnType<typeof setTimeout>;

	ngOnInit(): void {
		this.showRandomSentence();
	}

	ngOnDestroy(): void {
		clearTimeout(this.timeoutId);
	}

	showRandomSentence(): void {
		const randomIndex = Math.floor(Math.random() * this.sentences.length);
		this.currentSentence = this.sentences[randomIndex];
		this.displayedText.set('');
		this.index = 0;
		this.typingCompleted.set(false);
		this.typeEffect();
	}

	typeEffect(): void {
		if (this.index < this.currentSentence.length) {
			this.displayedText.update(text => text + this.currentSentence.charAt(this.index));
			this.index++;
			this.timeoutId = setTimeout(() => this.typeEffect(), this.speed); // Continue typing
		} else {
			this.typingCompleted.set(true);
			this.timeoutId = setTimeout(() => this.clearAndShowNextSentence(), 2000);
		}
	}

	clearAndShowNextSentence(): void {
		this.typingCompleted.set(false);
		this.displayedText.set('');
		this.showRandomSentence();
	}
}
