import {TestKey} from '@angular/cdk/testing';
import {TestbedHarnessEnvironment} from '@angular/cdk/testing/testbed';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {MatChipInputEvent} from '@angular/material/chips';
import {MatChipGridHarness} from '@angular/material/chips/testing';
import {MAT_DIALOG_DATA} from '@angular/material/dialog';
import {provideTranslateService} from '@ngx-translate/core';
import {DialogRefMock, aSourceDto, dialogRefMock, provideDialogRefMock, provideFakeIcons, refresh} from '../../../../testing/admin';
import {SourceEditDialogComponent, SourceEditDialogData} from './source-edit-dialog.component';

describe('SourceEditDialogComponent', () => {
	let fixture: ComponentFixture<SourceEditDialogComponent>;
	let component: SourceEditDialogComponent;
	let ref: DialogRefMock;
	const element = (): HTMLElement => fixture.nativeElement;
	const buttons = (): HTMLButtonElement[] => Array.from(element().querySelectorAll<HTMLButtonElement>('mat-dialog-actions button'));
	const nameInput = (): HTMLInputElement => element().querySelector<HTMLInputElement>('input[formControlName="name"]');

	const setup = (data: SourceEditDialogData): void => {
		ref = dialogRefMock();
		TestBed.configureTestingModule({
			imports: [SourceEditDialogComponent],
			providers: [provideTranslateService(), provideFakeIcons(), provideDialogRefMock(ref), {provide: MAT_DIALOG_DATA, useValue: data}]
		});
		fixture = TestBed.createComponent(SourceEditDialogComponent);
		component = fixture.componentInstance;
		refresh(fixture);
	};

	it('crée une source avec ses questions hypothétiques', async () => {
		setup({});
		expect(element().querySelector('h2')?.textContent).toBe('admin.sources.create.title');
		expect(buttons()[1].disabled).toBe(true);

		nameInput().value = 'lpp';
		nameInput().dispatchEvent(new Event('input'));
		const input = await (await TestbedHarnessEnvironment.loader(fixture).getHarness(MatChipGridHarness)).getInput();
		await input?.setValue('Qui est assuré ?');
		await input?.sendSeparatorKey(TestKey.ENTER);
		buttons()[1].click();

		expect(ref.close).toHaveBeenCalledWith({
			name: 'lpp',
			request: {name: 'lpp', description: '', hypotheticalQuestions: ['Qui est assuré ?']},
			isEdit: false
		});
	});

	it('modifie une source existante sans changer son nom', async () => {
		setup({source: aSourceDto()});
		expect(element().querySelector('h2')?.textContent).toBe('admin.sources.edit.title');
		expect(nameInput().disabled).toBe(true);

		const grid = await TestbedHarnessEnvironment.loader(fixture).getHarness(MatChipGridHarness);
		await (await grid.getRows())[0].remove();
		component.submit();

		expect(ref.close).toHaveBeenCalledWith({name: 'avs', request: {description: 'Assurance-vieillesse', hypotheticalQuestions: []}, isEdit: true});
	});

	it('ignore une question vide et refuse un nom manquant', () => {
		setup({});
		const event = {value: '  ', chipInput: {clear: jest.fn()}} as unknown as MatChipInputEvent;

		component.addQuestion(event);
		component.form.markAllAsTouched();
		component.submit();
		refresh(fixture);

		expect(component.hypotheticalQuestions).toEqual([]);
		expect(event.chipInput.clear).toHaveBeenCalled();
		expect(ref.close).not.toHaveBeenCalled();
		expect(element().textContent).toContain('admin.sources.name.required');
	});

	it('se ferme sans résultat à l’annulation', () => {
		setup({source: aSourceDto()});

		buttons()[0].click();

		expect(ref.close).toHaveBeenCalledWith();
	});
});
