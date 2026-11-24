import {TestKey} from '@angular/cdk/testing';
import {TestbedHarnessEnvironment} from '@angular/cdk/testing/testbed';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {MatChipInputEvent} from '@angular/material/chips';
import {MatChipGridHarness} from '@angular/material/chips/testing';
import {MAT_DIALOG_DATA} from '@angular/material/dialog';
import {MatSelectHarness} from '@angular/material/select/testing';
import {provideTranslateService} from '@ngx-translate/core';
import {of, throwError} from 'rxjs';
import {DialogRefMock, aSourceDto, aWorkspaceDto, dialogRefMock, provideDialogRefMock, provideFakeIcons, refresh} from '../../../../testing/admin';
import {SourceService} from '../../../shared/services/source.service';
import {WorkspaceEditDialogComponent, WorkspaceEditDialogData} from './workspace-edit-dialog.component';

describe('WorkspaceEditDialogComponent', () => {
	let fixture: ComponentFixture<WorkspaceEditDialogComponent>;
	let component: WorkspaceEditDialogComponent;
	let ref: DialogRefMock;
	let sourceService: {getAll: jest.Mock};
	const element = (): HTMLElement => fixture.nativeElement;
	const buttons = (): HTMLButtonElement[] => Array.from(element().querySelectorAll<HTMLButtonElement>('mat-dialog-actions button'));
	const nameInput = (): HTMLInputElement => element().querySelector<HTMLInputElement>('input[formControlName="name"]');

	const setup = (data: WorkspaceEditDialogData): void => {
		ref = dialogRefMock();
		TestBed.configureTestingModule({
			imports: [WorkspaceEditDialogComponent],
			providers: [
				provideTranslateService(),
				provideFakeIcons(),
				provideDialogRefMock(ref),
				{provide: MAT_DIALOG_DATA, useValue: data},
				{provide: SourceService, useValue: sourceService}
			]
		});
		fixture = TestBed.createComponent(WorkspaceEditDialogComponent);
		component = fixture.componentInstance;
		refresh(fixture);
	};

	beforeEach(() => {
		sourceService = {getAll: jest.fn(() => of([aSourceDto({name: 'avs'}), aSourceDto({id: 2, name: 'lpp'}), aSourceDto({id: 3, name: 'ai'})]))};
	});

	it('crée un workspace avec les sources choisies', async () => {
		setup({});
		expect(element().querySelector('h2')?.textContent).toBe('admin.workspaces.create.title');
		expect(buttons()[1].disabled).toBe(true);

		nameInput().value = 'invalidite';
		nameInput().dispatchEvent(new Event('input'));
		const loader = TestbedHarnessEnvironment.loader(fixture);
		const select = await loader.getHarness(MatSelectHarness);
		await select.open();
		expect((await select.getOptions()).length).toBe(3);
		await select.clickOptions({text: 'sources.ai'});
		const input = await (await loader.getHarness(MatChipGridHarness)).getInput();
		await input?.setValue('Qui a droit à une rente AI ?');
		await input?.sendSeparatorKey(TestKey.ENTER);
		buttons()[1].click();

		expect(ref.close).toHaveBeenCalledWith({
			name: 'invalidite',
			request: {name: 'invalidite', description: '', hypotheticalQuestions: ['Qui a droit à une rente AI ?'], sources: ['ai']},
			isEdit: false
		});
	});

	it('modifie un workspace existant sans changer son nom', async () => {
		setup({workspace: aWorkspaceDto()});
		expect(element().querySelector('h2')?.textContent).toBe('admin.workspaces.edit.title');
		expect(nameInput().disabled).toBe(true);

		const grid = await TestbedHarnessEnvironment.loader(fixture).getHarness(MatChipGridHarness);
		await (await grid.getRows())[0].remove();
		component.submit();

		expect(ref.close).toHaveBeenCalledWith({
			name: 'retraite',
			request: {description: 'Prévoyance vieillesse', hypotheticalQuestions: [], sources: ['avs', 'lpp']},
			isEdit: true
		});
	});

	it('propose une liste vide si les sources ne se chargent pas', () => {
		sourceService.getAll.mockReturnValue(throwError(() => new Error('500')));
		setup({});

		expect(component.availableSources).toEqual([]);
	});

	it('ignore une question vide et refuse un nom manquant', () => {
		setup({});
		const event = {value: '', chipInput: {clear: jest.fn()}} as unknown as MatChipInputEvent;

		component.addQuestion(event);
		component.form.markAllAsTouched();
		component.submit();
		refresh(fixture);

		expect(component.hypotheticalQuestions).toEqual([]);
		expect(ref.close).not.toHaveBeenCalled();
		expect(element().textContent).toContain('admin.workspaces.name.required');
	});

	it('se ferme sans résultat à l’annulation', () => {
		setup({});

		buttons()[0].click();

		expect(ref.close).toHaveBeenCalledWith();
	});
});
