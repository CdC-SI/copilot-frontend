import {ComponentFixture, TestBed} from '@angular/core/testing';
import {provideTranslateService} from '@ngx-translate/core';
import {DialogRefMock, dialogRefMock, provideDialogRefMock, refresh} from '../../../testing/admin';
import {RequestSourceDialogComponent} from './request-source-dialog.component';

describe('RequestSourceDialogComponent', () => {
	let fixture: ComponentFixture<RequestSourceDialogComponent>;
	let component: RequestSourceDialogComponent;
	let ref: DialogRefMock;
	const element = (): HTMLElement => fixture.nativeElement;
	const buttons = (): HTMLButtonElement[] => Array.from(element().querySelectorAll<HTMLButtonElement>('mat-dialog-actions button'));
	const type = (selector: string, value: string): void => {
		const field = element().querySelector<HTMLInputElement | HTMLTextAreaElement>(selector) as HTMLInputElement;
		field.value = value;
		field.dispatchEvent(new Event('input'));
		refresh(fixture);
	};

	beforeEach(() => {
		ref = dialogRefMock();
		TestBed.configureTestingModule({imports: [RequestSourceDialogComponent], providers: [provideTranslateService(), provideDialogRefMock(ref)]});
		fixture = TestBed.createComponent(RequestSourceDialogComponent);
		component = fixture.componentInstance;
		refresh(fixture);
	});

	it('renvoie la demande saisie', () => {
		expect(buttons()[1].disabled).toBe(true);

		type('input', 'Directives LPP');
		type('textarea', 'Ajouter les directives 2026.');
		buttons()[1].click();

		expect(ref.close).toHaveBeenCalledWith({sourceName: 'Directives LPP', description: 'Ajouter les directives 2026.'});
	});

	it('signale les champs obligatoires et trop longs sans fermer', () => {
		type('input', 'x'.repeat(201));
		component.submit();
		refresh(fixture);

		expect(ref.close).not.toHaveBeenCalled();
		expect(element().textContent).toContain('sources.request.name.maxlength');
		expect(element().textContent).toContain('sources.request.instructions.required');

		type('input', '');
		type('textarea', 'x'.repeat(1001));
		expect(element().textContent).toContain('sources.request.name.required');
		expect(element().textContent).toContain('sources.request.instructions.maxlength');
	});

	it('se ferme sans résultat à l’annulation', () => {
		buttons()[0].click();

		expect(ref.close).toHaveBeenCalledWith(null);
	});
});
