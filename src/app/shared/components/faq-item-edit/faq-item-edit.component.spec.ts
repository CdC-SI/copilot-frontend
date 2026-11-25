import {Component, EventEmitter} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {FormControl, ReactiveFormsModule} from '@angular/forms';
import {MATERIAL_ANIMATIONS} from '@angular/material/core';
import {TranslateService, provideTranslateService} from '@ngx-translate/core';
import {BehaviorSubject, of} from 'rxjs';
import {provideTestIcons} from '../../../../testing/shared-components';
import {IFaqItem} from '../../model/faq';
import {SettingsType} from '../../model/settings';
import {IUser, UserStatus} from '../../model/user';
import {AuthenticationServiceV2} from '../../services/auth.service';
import {SettingsEventService} from '../../services/settings-event.service';
import {SettingsService} from '../../services/settings.service';
import {FaqItemEditComponent} from './faq-item-edit.component';

@Component({
	template: '<zco-faq-item-edit [formControl]="item" [editMode]="true" />',
	imports: [FaqItemEditComponent, ReactiveFormsModule]
})
class HostComponent {
	readonly item = new FormControl<IFaqItem | null>(null);
}

describe('FaqItemEditComponent', () => {
	let fixture: ComponentFixture<HostComponent>;
	let item: FormControl<IFaqItem | null>;
	let settings: {getSettings: jest.Mock};
	let settingsEvents: {settingsNeedRefresh: EventEmitter<void>};
	let user$: BehaviorSubject<IUser>;

	const el = (): HTMLElement => fixture.nativeElement;
	const editor = (): FaqItemEditComponent => fixture.debugElement.children[0].componentInstance;
	const textarea = (name: string): HTMLTextAreaElement => el().querySelector(`textarea[name=${name}]`);
	const source = (): HTMLInputElement => el().querySelector('input[name=source]');
	const selects = (): HTMLElement[] => Array.from(el().querySelectorAll<HTMLElement>('mat-select'));
	const openedOptions = (select: HTMLElement): string[] => {
		select.click();
		fixture.detectChanges();
		const options = Array.from(document.querySelectorAll('mat-option')).map(option => option.textContent.trim());
		document.querySelector<HTMLElement>('.cdk-overlay-backdrop')?.click();
		fixture.detectChanges();
		return options;
	};
	const type = (element: HTMLInputElement | HTMLTextAreaElement, value: string): void => {
		element.value = value;
		element.dispatchEvent(new Event('input'));
		fixture.detectChanges();
	};
	const anItem = (): IFaqItem => ({
		id: '7d3c1f6e-2b4a-4c8e-9f10-5a6b7c8d9e0f',
		text: 'Quand ?',
		answer: 'À 65 ans.',
		url: 'https://ahv.ch',
		language: 'fr',
		tags: ['avs']
	});

	beforeEach(() => {
		settings = {getSettings: jest.fn(() => of(['lpp', '', 'avs', null]))};
		settingsEvents = {settingsNeedRefresh: new EventEmitter<void>()};
		user$ = new BehaviorSubject<IUser>(null);
		TestBed.configureTestingModule({
			imports: [HostComponent],
			providers: [
				provideTranslateService({lang: 'fr'}),
				provideTestIcons(),
				{provide: MATERIAL_ANIMATIONS, useValue: {animationsDisabled: true}},
				{provide: SettingsService, useValue: settings},
				{provide: SettingsEventService, useValue: settingsEvents},
				{provide: AuthenticationServiceV2, useValue: {$authenticatedUser: user$}}
			]
		});
		TestBed.inject(TranslateService).setTranslation('fr', {tags: {lpp: 'Prévoyance professionnelle', avs: 'Vieillesse'}});
		fixture = TestBed.createComponent(HostComponent);
		item = fixture.componentInstance.item;
		fixture.detectChanges();
	});

	afterEach(() => document.querySelector<HTMLElement>('.cdk-overlay-backdrop')?.click());

	it('propose les étiquettes non vides, triées par libellé traduit, et les langues', () => {
		expect(settings.getSettings).toHaveBeenCalledWith(SettingsType.TAG);
		expect(editor().TAGS).toEqual(['lpp', 'avs']);
		expect(editor().editMode).toBe(true);

		const [tags, languages] = selects();
		expect(openedOptions(tags)).toEqual(['Prévoyance professionnelle', 'Vieillesse']);
		expect(openedOptions(languages)).toEqual(['de', 'fr', 'it', 'en']);
	});

	it('recharge les étiquettes quand l’utilisateur devient actif ou que les paramètres changent', () => {
		user$.next({status: UserStatus.PENDING_ACTIVATION} as IUser);
		expect(settings.getSettings).toHaveBeenCalledTimes(1);

		user$.next({status: UserStatus.ACTIVE} as IUser);
		settingsEvents.settingsNeedRefresh.emit();

		expect(settings.getSettings).toHaveBeenCalledTimes(3);
	});

	it('affiche l’entrée reçue et la réinitialise sur null', () => {
		item.setValue(anItem());
		fixture.detectChanges();

		expect(textarea('question').value).toBe('Quand ?');
		expect(textarea('answer').value).toBe('À 65 ans.');
		expect(source().value).toBe('https://ahv.ch');
		expect(item.valid).toBe(true);

		item.setValue(null);
		fixture.detectChanges();

		expect(textarea('question').value).toBe('');
		expect(item.errors).toEqual({invalid: true});
	});

	it('remonte chaque saisie avec l’entrée complète', () => {
		item.setValue(anItem());
		fixture.detectChanges();

		type(textarea('answer'), 'Dès 65 ans.');
		type(source(), 'https://www.ahv-iv.ch');

		expect(item.value).toEqual({...anItem(), answer: 'Dès 65 ans.', url: 'https://www.ahv-iv.ch'});
	});

	it('est invalide tant qu’un champ requis manque', () => {
		type(textarea('question'), 'Quand ?');
		type(textarea('answer'), 'À 65 ans.');
		type(source(), 'https://ahv.ch');

		expect(item.errors).toEqual({invalid: true});

		item.setValue(anItem());
		expect(item.errors).toBeNull();
	});

	it('se désactive et se réactive avec le contrôle parent', () => {
		item.disable();
		fixture.detectChanges();
		expect(textarea('question').disabled).toBe(true);
		expect(source().disabled).toBe(true);

		item.enable();
		fixture.detectChanges();
		expect(textarea('question').disabled).toBe(false);
	});

	it('se signale invalide avant initialisation', () => {
		const standalone = TestBed.createComponent(FaqItemEditComponent).componentInstance;

		expect(standalone.validate()).toEqual({invalid: true});
	});

	it('mémorise la fonction de contact et cesse d’écouter à la destruction', () => {
		const touched = jest.fn();
		editor().registerOnTouched(touched);
		expect(editor()._onTouched).toBe(touched);

		fixture.destroy();
		settingsEvents.settingsNeedRefresh.emit();

		expect(settings.getSettings).toHaveBeenCalledTimes(1);
	});
});
