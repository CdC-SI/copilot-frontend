import {ComponentFixture, TestBed} from '@angular/core/testing';
import {provideNativeDateAdapter} from '@angular/material/core';
import {MAT_DIALOG_DATA} from '@angular/material/dialog';
import {provideTranslateService} from '@ngx-translate/core';
import {DialogRefMock, dialogRefMock, provideDialogRefMock, refresh} from '../../../../testing/admin';
import {ReactivateDialogComponent} from './reactivate-dialog.component';

describe('ReactivateDialogComponent', () => {
	let fixture: ComponentFixture<ReactivateDialogComponent>;
	let component: ReactivateDialogComponent;
	let ref: DialogRefMock;
	const element = (): HTMLElement => fixture.nativeElement;
	const buttons = (): HTMLButtonElement[] => Array.from(element().querySelectorAll<HTMLButtonElement>('mat-dialog-actions button'));

	const setup = (current?: string | null): void => {
		ref = dialogRefMock();
		TestBed.configureTestingModule({
			imports: [ReactivateDialogComponent],
			providers: [provideTranslateService(), provideNativeDateAdapter(), provideDialogRefMock(ref), {provide: MAT_DIALOG_DATA, useValue: {current}}]
		});
		fixture = TestBed.createComponent(ReactivateDialogComponent);
		component = fixture.componentInstance;
		refresh(fixture);
	};

	beforeEach(() => {
		jest.useFakeTimers({now: new Date(2026, 0, 15, 10, 30)});
	});

	afterEach(() => jest.useRealTimers());

	it('propose l’échéance actuelle si elle est future', () => {
		setup('2026-03-01T17:45:00');

		expect(component.form.value).toEqual({date: new Date(2026, 2, 1), time: '17:45'});
	});

	it.each([null, '2025-12-31T23:59', 'date invalide'])('propose dans deux heures une échéance passée ou illisible (%p)', current => {
		setup(current);

		expect(component.form.value).toEqual({date: new Date(2026, 0, 15), time: '12:00'});
	});

	it('renvoie la nouvelle échéance sans fuseau', () => {
		setup('2026-03-01T17:45:00');
		component.form.patchValue({time: '08:05'});

		buttons()[1].click();

		expect(ref.close).toHaveBeenCalledWith('2026-03-01T08:05:00');
	});

	it('termine la journée sans heure saisie', () => {
		setup();
		component.form.patchValue({time: ''});

		component.submit();

		expect(ref.close).toHaveBeenCalledWith('2026-01-15T23:59:00');
	});

	it('refuse une heure invalide ou une date manquante', () => {
		setup();
		component.form.patchValue({time: '25:00'});
		component.form.markAllAsTouched();
		refresh(fixture);
		expect(buttons()[1].disabled).toBe(true);
		expect(element().textContent).toContain('admin.alerts.reactivate.time.invalid');

		component.form.patchValue({time: '10:00', date: null});
		refresh(fixture);
		component.submit();

		expect(element().textContent).toContain('admin.alerts.reactivate.date.required');
		expect(ref.close).not.toHaveBeenCalled();
	});

	it('se ferme sans résultat à l’annulation', () => {
		setup();

		buttons()[0].click();

		expect(ref.close).toHaveBeenCalledWith(null);
	});
});
