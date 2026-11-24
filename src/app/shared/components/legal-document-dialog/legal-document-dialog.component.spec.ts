import {ComponentFixture, TestBed} from '@angular/core/testing';
import {MAT_DIALOG_DATA} from '@angular/material/dialog';
import {provideTranslateService} from '@ngx-translate/core';
import {LEGAL_CONFIDENTIALITY_TEXT} from '../../constants/legal-texts.constants';
import {provideCloseableDialogRef} from '../../../../testing/shared-components';
import {LegalDocumentDialogComponent, LegalDocumentDialogData} from './legal-document-dialog.component';

describe('LegalDocumentDialogComponent', () => {
	let fixture: ComponentFixture<LegalDocumentDialogComponent>;
	let close: jest.Mock;
	const el = (): HTMLElement => fixture.nativeElement;

	const setup = (data: LegalDocumentDialogData | null): void => {
		close = jest.fn();
		TestBed.configureTestingModule({
			imports: [LegalDocumentDialogComponent],
			providers: [provideTranslateService(), provideCloseableDialogRef(close), {provide: MAT_DIALOG_DATA, useValue: data}]
		});
		fixture = TestBed.createComponent(LegalDocumentDialogComponent);
		fixture.detectChanges();
	};

	it('ouvre l’onglet de confidentialité par défaut', () => {
		setup(null);

		expect(fixture.componentInstance.selectedTabIndex).toBe(0);
		expect(el().querySelector('h2').textContent.trim()).toBe('documents.legal');
		const tabs = Array.from(el().querySelectorAll('[role=tab]')).map(tab => tab.textContent.trim());
		expect(tabs).toEqual(['confidentiality', 'gcu']);
		expect(fixture.componentInstance.confidentialityText).toBe(LEGAL_CONFIDENTIALITY_TEXT);
		expect(el().querySelector('.document-text h2').textContent).toBe('Introduction');
	});

	it('ouvre l’onglet des conditions générales sur demande', () => {
		setup({selectedTab: 'gcu'});

		expect(fixture.componentInstance.selectedTabIndex).toBe(1);
		expect(el().querySelector('[role=tab][aria-selected=true]').textContent.trim()).toBe('gcu');
		expect(el().querySelector('.mat-mdc-tab-body-active .document-text h2').textContent).toBe("Conditions d'utilisation");
	});

	it('reste sur la confidentialité si l’onglet demandé est la confidentialité', () => {
		setup({selectedTab: 'confidentiality'});

		expect(fixture.componentInstance.selectedTabIndex).toBe(0);
	});

	it('se ferme au clic sur « fermer »', () => {
		setup({});

		el().querySelector<HTMLButtonElement>('[mat-dialog-actions] button').click();

		expect(close).toHaveBeenCalledWith();
	});
});
