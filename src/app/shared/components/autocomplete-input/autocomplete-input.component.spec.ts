import {Component, viewChild} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {FormControl, ReactiveFormsModule} from '@angular/forms';
import {MATERIAL_ANIMATIONS} from '@angular/material/core';
import {provideTranslateService} from '@ngx-translate/core';
import {Observable, of} from 'rxjs';
import {provideTestIcons} from '../../../../testing/shared-components';
import {AutocompleteInputComponent} from './autocomplete-input.component';

interface Suggestion {
	id: number;
	label: string;
}

@Component({
	template: `<ut-autocomplete-input
		[formControl]="question"
		i18nLabel="chat.placeholder"
		[minLength]="2"
		[optionService]="optionService"
		[inputLabelFn]="inputLabel"
		[optionLabelFn]="optionLabel"
		(optionSelected)="selected.push($event)"
		(inputChange)="inputs.push($event)"
		(attachmentsSelected)="attachments.push($event)"
		(submitMessage)="submits = submits + 1"
	/>`,
	imports: [AutocompleteInputComponent, ReactiveFormsModule]
})
class HostComponent {
	readonly input = viewChild.required(AutocompleteInputComponent<Suggestion>);
	readonly question = new FormControl<string | Suggestion>('');
	readonly selected: Suggestion[] = [];
	readonly inputs: string[] = [];
	readonly attachments: File[][] = [];
	submits = 0;
	optionService = jest.fn<Observable<Suggestion[]>, [string]>(() => of([]));
	readonly inputLabel = (value: Suggestion): string => `#${value.id}`;
	readonly optionLabel = (value: Suggestion): string => value?.label;
}

describe('AutocompleteInputComponent', () => {
	let fixture: ComponentFixture<HostComponent>;
	let host: HostComponent;

	const el = (): HTMLElement => fixture.nativeElement;
	const textarea = (): HTMLTextAreaElement => el().querySelector('textarea');
	const fileInput = (): HTMLInputElement => el().querySelector('input[type=file]');
	const options = (): HTMLElement[] => Array.from(document.querySelectorAll<HTMLElement>('mat-option'));
	const type = (value: string): void => {
		textarea().focus();
		textarea().value = value;
		textarea().dispatchEvent(new Event('input'));
		fixture.detectChanges();
	};
	const suggestions: Suggestion[] = [
		{id: 1, label: 'Rente AVS'},
		{id: 2, label: 'Rente AI'}
	];

	beforeEach(() => {
		jest.useFakeTimers();
		TestBed.configureTestingModule({
			imports: [HostComponent],
			providers: [provideTranslateService(), provideTestIcons(), {provide: MATERIAL_ANIMATIONS, useValue: {animationsDisabled: true}}]
		});
		fixture = TestBed.createComponent(HostComponent);
		host = fixture.componentInstance;
		fixture.detectChanges();
	});

	afterEach(() => {
		fixture.destroy();
		jest.useRealTimers();
	});

	it('affiche une zone de saisie libellée et requise par défaut', () => {
		expect(textarea().placeholder).toBe('chat.placeholder');
		expect(textarea().getAttribute('aria-label')).toBe('chat.placeholder');
		expect(el().querySelector('.attach-button').getAttribute('aria-label')).toBe('add.attachment');
		expect(host.input().formControl.hasError('required')).toBe(true);
	});

	it('remonte la saisie au formulaire parent et à l’événement de saisie', () => {
		type('Bonjour');

		expect(host.question.value).toBe('Bonjour');
		expect(host.inputs).toEqual(['Bonjour']);
	});

	it('affiche la valeur écrite par le formulaire parent et émet une saisie vide à la réinitialisation', async () => {
		host.question.setValue('Question initiale');
		// MatAutocompleteTrigger écrit la valeur dans la zone de saisie au tour de microtâche suivant.
		await Promise.resolve();
		expect(textarea().value).toBe('Question initiale');

		host.question.reset();

		expect(host.inputs).toEqual(['Question initiale', '']);
	});

	it('propose des suggestions surlignées au-delà de la longueur minimale, après un délai', () => {
		host.optionService.mockReturnValue(of(suggestions));

		type('Re');
		jest.advanceTimersByTime(200);
		expect(host.optionService).not.toHaveBeenCalled();

		type('Ren');
		jest.advanceTimersByTime(199);
		expect(host.optionService).not.toHaveBeenCalled();
		jest.advanceTimersByTime(1);
		fixture.detectChanges();

		expect(host.optionService).toHaveBeenCalledWith('Ren');
		expect(options().map(option => option.textContent)).toEqual(['Rente AVS', 'Rente AI']);
		expect(options()[0].querySelector('.zco-highlight-text').textContent).toBe('Ren');
	});

	it('sélectionne une suggestion : libellé de saisie, événement et valeur du formulaire', () => {
		host.optionService.mockReturnValue(of(suggestions));
		type('Rente');
		jest.advanceTimersByTime(200);
		fixture.detectChanges();

		options()[1].click();
		fixture.detectChanges();

		expect(host.selected).toEqual([suggestions[1]]);
		expect(host.question.value).toEqual(suggestions[1]);
		expect(host.input().selected).toBe(true);
		expect(textarea().value).toBe('#2');
		expect(host.inputs.at(-1)).toBe('');
	});

	it('affiche le libellé d’option, ou la valeur brute à défaut', () => {
		const display = host.input().getProposalLabelFn();

		expect(display({id: 3, label: 'Rente'})).toBe('Rente');
		expect(display('texte libre' as unknown as Suggestion)).toBe('texte libre');
	});

	it('vide les suggestions quand la saisie est effacée', () => {
		host.optionService.mockReturnValue(of(suggestions));
		type('Rente');
		jest.advanceTimersByTime(200);

		host.question.setValue(null);
		jest.advanceTimersByTime(200);
		fixture.detectChanges();

		expect(host.optionService).toHaveBeenCalledTimes(1);
		expect(options()).toHaveLength(0);
	});

	it('envoie le message sur Entrée, mais pas sur Maj+Entrée', () => {
		const enter = new KeyboardEvent('keydown', {key: 'Enter', cancelable: true});
		textarea().dispatchEvent(enter);
		textarea().dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', shiftKey: true}));
		textarea().dispatchEvent(new KeyboardEvent('keydown', {key: 'a'}));

		expect(host.submits).toBe(1);
		expect(enter.defaultPrevented).toBe(true);
	});

	it('ouvre le sélecteur de fichiers et remonte les pièces jointes choisies', () => {
		const click = jest.spyOn(fileInput(), 'click').mockImplementation(() => undefined);
		el().querySelector<HTMLButtonElement>('.attach-button').click();
		expect(click).toHaveBeenCalled();

		const files = [new File(['a'], 'a.pdf'), new File(['b'], 'b.png')];
		Object.defineProperty(fileInput(), 'files', {configurable: true, value: files});
		fileInput().dispatchEvent(new Event('change'));

		expect(host.attachments).toEqual([files]);
	});

	it('ignore un changement de fichiers sans liste', () => {
		Object.defineProperty(fileInput(), 'files', {configurable: true, value: null});

		fileInput().dispatchEvent(new Event('change'));

		expect(host.attachments).toEqual([]);
	});

	it('suit l’état désactivé du formulaire parent', () => {
		host.question.disable();
		fixture.detectChanges();
		expect(textarea().disabled).toBe(true);

		host.question.enable();
		fixture.detectChanges();
		expect(textarea().disabled).toBe(false);
	});

	it('donne le focus à la zone de saisie et mémorise la fonction de contact', () => {
		const touched = jest.fn();

		host.input().focus();
		host.input().registerOnTouched(touched);

		expect(document.activeElement).toBe(textarea());
		expect(host.input()._onTouched).toBe(touched);
	});
});
