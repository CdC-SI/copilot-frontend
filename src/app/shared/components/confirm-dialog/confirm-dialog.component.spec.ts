import {ComponentFixture, TestBed} from '@angular/core/testing';
import {MAT_DIALOG_DATA} from '@angular/material/dialog';
import {provideTranslateService} from '@ngx-translate/core';
import {ObIAlertType} from '@oblique/oblique';
import {provideCloseableDialogRef, provideTestIcons} from '../../../../testing/shared-components';
import {ConfirmDialogComponent} from './confirm-dialog.component';

describe('ConfirmDialogComponent', () => {
	let fixture: ComponentFixture<ConfirmDialogComponent>;
	let close: jest.Mock;
	const el = (): HTMLElement => fixture.nativeElement;
	const buttons = (): HTMLButtonElement[] => Array.from(el().querySelectorAll('[mat-dialog-actions] button'));

	const setup = (data: {title: string; content: string; type?: ObIAlertType}): void => {
		close = jest.fn();
		TestBed.configureTestingModule({
			imports: [ConfirmDialogComponent],
			providers: [provideTranslateService(), provideTestIcons(), provideCloseableDialogRef(close), {provide: MAT_DIALOG_DATA, useValue: data}]
		});
		fixture = TestBed.createComponent(ConfirmDialogComponent);
		fixture.detectChanges();
	};

	it('affiche le titre et le contenu dans une alerte d’information par défaut', () => {
		setup({title: 'delete.title', content: 'delete.content'});

		expect(el().querySelector('[mat-dialog-title]').textContent.trim()).toBe('delete.title');
		expect(el().querySelector<HTMLElement>('[mat-dialog-content]').hidden).toBe(false);
		expect(el().querySelector('ob-alert').textContent).toContain('delete.content');
		expect(fixture.componentInstance.type).toBe('info');
	});

	it('reprend le type d’alerte demandé', () => {
		setup({title: 't', content: 'c', type: 'warning'});

		expect(fixture.componentInstance.type).toBe('warning');
	});

	it('masque le contenu s’il est vide', () => {
		setup({title: 't', content: ''});

		expect(el().querySelector<HTMLElement>('[mat-dialog-content]').hidden).toBe(true);
	});

	it('se ferme avec false au retour et true à la confirmation', () => {
		setup({title: 't', content: 'c'});

		buttons()[0].click();
		expect(close).toHaveBeenLastCalledWith(false);

		buttons()[1].click();
		expect(close).toHaveBeenLastCalledWith(true);
	});
});
