import {ComponentFixture, TestBed} from '@angular/core/testing';
import {FormControl, FormGroup, Validators} from '@angular/forms';
import {provideNativeDateAdapter} from '@angular/material/core';
import {provideTranslateService} from '@ngx-translate/core';
import {ActionId, ControlDef, FormDef} from '../../model/form-definition';
import {provideTestIcons} from '../../../../testing/shared-components';
import {DynamicFormComponent} from './dynamic-form.component';

describe('DynamicFormComponent', () => {
	let fixture: ComponentFixture<DynamicFormComponent>;
	let submitted: jest.Mock;
	let closed: jest.Mock;

	const el = (): HTMLElement => fixture.nativeElement;
	const controls: ControlDef[] = [
		{key: 'nom', label: 'Nom', type: 'text', validationMessage: 'Nom requis', extraClass: 'wide'},
		{key: 'age', label: 'Âge', type: 'number'},
		{key: 'remarque', label: 'Remarque', type: 'textarea'},
		{key: 'branche', label: 'Branche', type: 'select', options: [{value: '01-03', label: 'Primaire'}]},
		{key: 'debut', label: 'Début', type: 'date', validationMessage: 'Date requise'}
	];
	const aForm = (): FormGroup =>
		new FormGroup({
			nom: new FormControl('', Validators.required),
			age: new FormControl<number>(null),
			remarque: new FormControl(''),
			branche: new FormControl(''),
			debut: new FormControl<Date>(null, Validators.required)
		});
	const labels = (): string[] => Array.from(el().querySelectorAll('mat-label')).map(label => label.textContent.trim());
	const errors = (): string[] => Array.from(el().querySelectorAll('mat-error')).map(error => error.textContent.trim());
	/** Élément de saisie (input, textarea ou mat-select) du champ libellé label. */
	const field = (label: string, root: HTMLElement = el()): HTMLElement =>
		Array.from(root.querySelectorAll('mat-form-field'))
			.find(formField => formField.querySelector('mat-label').textContent.trim() === label)
			?.querySelector('input, textarea, mat-select');
	const submitButton = (): HTMLButtonElement => el().querySelector('button.submit-btn');

	const render = (def: Partial<FormDef>, form = aForm()): FormGroup => {
		fixture.componentRef.setInput('def', {actionId: ActionId.II_CALCUL, messageTemplate: '', ...def});
		fixture.componentRef.setInput('form', form);
		fixture.detectChanges();
		return form;
	};

	beforeEach(() => {
		TestBed.configureTestingModule({imports: [DynamicFormComponent], providers: [provideNativeDateAdapter(), provideTranslateService(), provideTestIcons()]});
		fixture = TestBed.createComponent(DynamicFormComponent);
		submitted = jest.fn();
		closed = jest.fn();
		fixture.componentInstance.submitted.subscribe(submitted);
		fixture.componentInstance.closeForm.subscribe(closed);
	});

	describe('liste plate de champs', () => {
		it('affiche un champ par contrôle, selon son type', () => {
			render({controls, cssClass: 'ii-form'});

			expect(el().querySelector('form').classList).toContain('ii-form');
			expect(el().querySelector('mat-accordion')).toBeNull();
			expect(labels()).toEqual(['Nom', 'Âge', 'Remarque', 'Branche', 'Début']);
			expect(field('Nom').tagName).toBe('INPUT');
			expect((field('Âge') as HTMLInputElement).type).toBe('number');
			expect(field('Remarque').tagName).toBe('TEXTAREA');
			expect(field('Branche').tagName).toBe('MAT-SELECT');
			expect(field('Début').hasAttribute('aria-haspopup')).toBe(true);
			expect(el().querySelector('mat-datepicker-toggle')).not.toBeNull();
			expect(el().querySelector('mat-form-field.wide mat-label').textContent).toBe('Nom');
		});

		it('signale les champs requis à l’envoi d’un formulaire invalide', () => {
			const form = render({controls});
			expect(submitButton().disabled).toBe(true);

			el().querySelector('form').dispatchEvent(new Event('submit'));
			fixture.detectChanges();

			expect(submitted).not.toHaveBeenCalled();
			expect(form.touched).toBe(true);
			expect(errors()).toEqual(['Champ requis', 'Champ requis']);
		});

		it('émet l’envoi d’un formulaire valide', () => {
			const form = render({controls});
			const nom = field('Nom') as HTMLInputElement;
			nom.value = 'Dupont';
			nom.dispatchEvent(new Event('input'));
			form.controls['debut'].setValue(new Date(2026, 0, 1));
			fixture.detectChanges();

			expect(submitButton().disabled).toBe(false);
			submitButton().click();

			expect(form.value.nom).toBe('Dupont');
			expect(submitted).toHaveBeenCalledTimes(1);
		});
	});

	describe('sections', () => {
		const sections = [
			{title: 'Assuré', controls: controls.slice(0, 2)},
			{cssClass: 'block', controls: controls.slice(3)},
			{title: 'Remarques', expanded: true, controls: controls.slice(2, 3)}
		];

		it('regroupe les champs par section, la première ouverte par défaut', () => {
			render({sections, controls});

			const panels = Array.from(el().querySelectorAll<HTMLElement>('mat-expansion-panel'));
			expect(panels.map(panel => panel.querySelector('mat-panel-title').textContent.trim())).toEqual(['Assuré', 'Section 2', 'Remarques']);
			expect(panels.map(panel => panel.classList.contains('mat-expanded'))).toEqual([true, false, true]);
			expect(panels[0].classList).toContain('section-wrapper');
			expect(panels[1].classList).toContain('block');
			expect(field('Nom', panels[0]).tagName).toBe('INPUT');
			expect((field('Âge', panels[0]) as HTMLInputElement).type).toBe('number');
			expect(field('Branche', panels[1]).tagName).toBe('MAT-SELECT');
			expect(panels[1].querySelector('mat-datepicker-toggle')).not.toBeNull();
			expect(field('Remarque', panels[2]).tagName).toBe('TEXTAREA');
		});

		it('affiche les messages d’erreur propres aux champs', () => {
			const form = render({sections});

			fixture.componentInstance.submit();
			fixture.detectChanges();

			expect(form.touched).toBe(true);
			expect(errors()).toEqual(['Nom requis', 'Date requise']);
		});
	});

	it('se ferme sur le bouton de fermeture ou la touche Échap', () => {
		render({controls});

		el().querySelector<HTMLButtonElement>('button.close-btn').click();
		el()
			.querySelector('form')
			.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape'}));

		expect(closed).toHaveBeenCalledTimes(2);
		expect(submitted).not.toHaveBeenCalled();
	});
});
