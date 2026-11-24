import {ComponentFixture, TestBed} from '@angular/core/testing';
import {MATERIAL_ANIMATIONS} from '@angular/material/core';
import {provideTranslateService} from '@ngx-translate/core';
import {BehaviorSubject} from 'rxjs';
import {LEGAL_CONFIDENTIALITY_TEXT, LEGAL_GCU_TEXT} from '../../constants/legal-texts.constants';
import {IUser, UserFormFields} from '../../model/user';
import {AuthenticationServiceV2} from '../../services/auth.service';
import {provideCloseableDialogRef, provideTestIcons} from '../../../../testing/shared-components';
import {SignUpComponent} from './sign-up.component';

describe('SignUpComponent', () => {
	let fixture: ComponentFixture<SignUpComponent>;
	let component: SignUpComponent;
	let close: jest.Mock;

	const el = (): HTMLElement => fixture.nativeElement;
	const checkbox = (name: string): HTMLInputElement => el().querySelector(`mat-checkbox[name=${name}] input`);
	const createButton = (): HTMLButtonElement => el().querySelector('.save-button button');
	const control = (field: UserFormFields) => component.userFrmGrp.get(field);

	/** Simule un défilement du document affiché jusqu'à `remaining` pixels de la fin. */
	const scrollDocument = (remaining: number): void => {
		const content = el().querySelector<HTMLElement>('.mat-mdc-tab-body-active .document-content');
		Object.defineProperty(content, 'scrollHeight', {configurable: true, value: 1000});
		Object.defineProperty(content, 'clientHeight', {configurable: true, value: 400});
		content.scrollTop = 600 - remaining;
		content.dispatchEvent(new Event('scroll'));
		fixture.detectChanges();
	};
	const showTab = async (index: number): Promise<void> => {
		el().querySelectorAll<HTMLElement>('[role=tab]')[index].click();
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();
	};
	const readBothDocuments = async (): Promise<void> => {
		scrollDocument(0);
		await showTab(1);
		scrollDocument(10);
	};

	const setup = (user: Partial<IUser> | null): void => {
		close = jest.fn();
		TestBed.configureTestingModule({
			imports: [SignUpComponent],
			providers: [
				provideTranslateService(),
				provideTestIcons(),
				provideCloseableDialogRef(close),
				// Changement d'onglet immédiat (jsdom ne déclenche pas les fins de transition).
				{provide: MATERIAL_ANIMATIONS, useValue: {animationsDisabled: true}},
				{provide: AuthenticationServiceV2, useValue: {$authenticatedUser: new BehaviorSubject(user)}}
			]
		});
		fixture = TestBed.createComponent(SignUpComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	};

	it('préremplit le nom de l’utilisateur et verrouille les acceptations', () => {
		setup({firstName: 'Anne', lastName: 'Dupont'});

		expect(el().querySelector<HTMLInputElement>('input[name=firstName]').value).toBe('Anne');
		expect(el().querySelector<HTMLInputElement>('input[name=lastName]').value).toBe('Dupont');
		expect(['accept-documents', 'ai-awareness', 'ai-training'].map(name => checkbox(name).disabled)).toEqual([true, true, true]);
		expect(Array.from(el().querySelectorAll('.disabled-text')).map(text => text.textContent)).toEqual([
			'i.accept.all.documents',
			'i.followed.ai.awareness.session',
			'i.followed.ai.training'
		]);
		expect(createButton().disabled).toBe(true);
		expect(component.confidentialityText).toBe(LEGAL_CONFIDENTIALITY_TEXT);
		expect(component.gcuText).toBe(LEGAL_GCU_TEXT);
	});

	it('n’autorise l’acceptation qu’après lecture des deux documents jusqu’au bout', async () => {
		setup({firstName: 'Anne', lastName: 'Dupont'});

		scrollDocument(51);
		expect(component.hasScrolledConfidentialityToBottom).toBe(false);

		scrollDocument(50);
		expect(component.hasScrolledConfidentialityToBottom).toBe(true);
		expect(component.canCheckAcceptDocuments).toBe(false);
		expect(checkbox('accept-documents').disabled).toBe(true);

		await showTab(1);
		expect(component.selectedTabIndex).toBe(1);
		scrollDocument(0);

		expect(component.hasScrolledGCUToBottom).toBe(true);
		expect(component.canCheckAcceptDocuments).toBe(true);
		expect(checkbox('accept-documents').disabled).toBe(false);
		expect(checkbox('ai-awareness').disabled).toBe(true);
	});

	it('déverrouille les attestations IA à l’acceptation et les réinitialise au retrait', async () => {
		setup({firstName: 'Anne', lastName: 'Dupont'});
		await readBothDocuments();

		checkbox('accept-documents').click();
		fixture.detectChanges();
		expect(checkbox('ai-awareness').disabled).toBe(false);
		expect(checkbox('ai-training').disabled).toBe(false);

		checkbox('ai-awareness').click();
		checkbox('ai-training').click();
		fixture.detectChanges();
		expect(control(UserFormFields.AI_AWARENESS).value).toBe(true);

		checkbox('accept-documents').click();
		fixture.detectChanges();
		expect(control(UserFormFields.AI_AWARENESS).value).toBe(false);
		expect(control(UserFormFields.AI_TRAINING).value).toBe(false);
		expect(checkbox('ai-awareness').disabled).toBe(true);
		expect(checkbox('ai-training').disabled).toBe(true);
		expect(component.isFormValid).toBe(false);
	});

	it('crée le compte ZAS une fois tout accepté', async () => {
		setup({firstName: 'Anne', lastName: 'Dupont'});
		await readBothDocuments();
		checkbox('accept-documents').click();
		fixture.detectChanges();
		checkbox('ai-awareness').click();
		checkbox('ai-training').click();
		const lastName = el().querySelector<HTMLInputElement>('input[name=lastName]');
		lastName.value = 'Martin';
		lastName.dispatchEvent(new Event('input'));
		fixture.detectChanges();

		expect(createButton().disabled).toBe(false);
		createButton().click();

		expect(close).toHaveBeenCalledWith({firstName: 'Anne', lastName: 'Martin', organizations: ['ZAS']});
	});

	it('crée un compte sans organisation hors ZAS', () => {
		setup({firstName: 'Anne', lastName: 'Dupont'});

		component.onToggleChange();
		component.onConfirmClick();

		expect(close).toHaveBeenCalledWith({firstName: 'Anne', lastName: 'Dupont', organizations: []});
	});

	it('exige le nom quand l’utilisateur n’est pas encore connu', async () => {
		setup(null);
		await readBothDocuments();
		control(UserFormFields.CONFIDENTIALITY).setValue(true);
		component.onAcceptDocumentsChange();
		control(UserFormFields.AI_AWARENESS).setValue(true);
		control(UserFormFields.AI_TRAINING).setValue(true);
		fixture.detectChanges();

		expect(el().querySelector<HTMLInputElement>('input[name=firstName]').value).toBe('');
		expect(component.isFormValid).toBe(false);
		expect(createButton().disabled).toBe(true);
	});
});
