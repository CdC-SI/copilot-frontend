import {ComponentFixture, TestBed} from '@angular/core/testing';
import {provideTranslateService} from '@ngx-translate/core';
import {ActionSuggestionsComponent} from './action-suggestions.component';

describe('ActionSuggestionsComponent', () => {
	let fixture: ComponentFixture<ActionSuggestionsComponent>;
	const buttons = (): HTMLButtonElement[] => Array.from(fixture.nativeElement.querySelectorAll('button'));

	beforeEach(() => {
		TestBed.configureTestingModule({imports: [ActionSuggestionsComponent], providers: [provideTranslateService()]});
		fixture = TestBed.createComponent(ActionSuggestionsComponent);
	});

	it('affiche un bouton par suggestion, avec la classe de son action', () => {
		fixture.componentRef.setInput('suggestions', [
			{text: 'action.calcul', action: 'II_CALCUL'},
			{text: 'action.autre', action: 'AUTRE'}
		]);
		fixture.detectChanges();

		expect(buttons().map(button => button.textContent.trim())).toEqual(['action.calcul', 'action.autre']);
		expect(buttons()[0].classList).toContain('suggestion-button');
		expect(buttons()[0].classList).toContain('action-II_CALCUL');
		expect(buttons()[1].classList).toContain('action-AUTRE');
	});

	it('émet l’action de la suggestion cliquée', () => {
		const selected = jest.fn();
		fixture.componentInstance.actionSelected.subscribe(selected);
		fixture.componentRef.setInput('suggestions', [
			{text: 'a', action: 'A'},
			{text: 'b', action: 'B'}
		]);
		fixture.detectChanges();

		buttons()[1].click();

		expect(selected).toHaveBeenCalledWith('B');
	});

	it('n’affiche aucun bouton sans suggestion', () => {
		fixture.componentRef.setInput('suggestions', []);
		fixture.detectChanges();

		expect(buttons()).toHaveLength(0);
	});
});
