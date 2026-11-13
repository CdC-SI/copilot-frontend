import {ChatMessageComponent} from './chat-message.component';
import {ChatMessageSource} from '../../model/chat-message';

describe('ChatMessageComponent (modification de la question)', () => {
	let component: ChatMessageComponent;
	let emitted: string[];

	beforeEach(() => {
		component = new ChatMessageComponent();
		component.message = {message: 'Question initiale', source: ChatMessageSource.USER, timestamp: new Date()};
		emitted = [];
		component.editQuestion.subscribe(q => emitted.push(q));
	});

	it('pré-remplit le formulaire avec la question', () => {
		component.startEdit();
		expect(component.editing).toBe(true);
		expect(component.editedQuestion).toBe('Question initiale');
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
});
