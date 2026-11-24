import {Component, forwardRef} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {ControlValueAccessor, NG_VALUE_ACCESSOR} from '@angular/forms';
import {provideTranslateService} from '@ngx-translate/core';
import {of} from 'rxjs';
import {dialogMock, provideDialogMock, provideFakeIcons} from '../../../testing/admin';
import {NotificationMock, notificationMock, provideNotificationMock} from '../../../testing/angular';
import {ConfirmDialogComponent} from '../../shared/components/confirm-dialog/confirm-dialog.component';
import {FaqItemEditComponent} from '../../shared/components/faq-item-edit/faq-item-edit.component';
import {IFaqItem} from '../../shared/model/faq';
import {FaqItemsService} from '../../shared/services/faq-items.service';
import {FaqEditComponent} from './faq-edit.component';

@Component({
	selector: 'zco-faq-item-edit',
	template: '',
	providers: [{provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => FaqItemEditStubComponent), multi: true}]
})
class FaqItemEditStubComponent implements ControlValueAccessor {
	value: unknown;
	onChange: (value: unknown) => void = () => undefined;

	writeValue(value: unknown): void {
		this.value = value;
	}

	registerOnChange(fn: (value: unknown) => void): void {
		this.onChange = fn;
	}

	registerOnTouched(): void {
		return undefined;
	}
}

describe('FaqEditComponent', () => {
	let fixture: ComponentFixture<FaqEditComponent>;
	let component: FaqEditComponent;
	let notifications: NotificationMock;
	let faqItemsService: {add: jest.Mock};
	let dialog: ReturnType<typeof dialogMock>;
	const item = {question: 'Âge de la retraite ?', answer: '65 ans'} as unknown as IFaqItem;
	const editor = (): FaqItemEditStubComponent =>
		fixture.debugElement.query(debug => debug.componentInstance instanceof FaqItemEditStubComponent).componentInstance;

	beforeEach(() => {
		notifications = notificationMock();
		faqItemsService = {add: jest.fn(() => of(item))};
		dialog = dialogMock(true);
		TestBed.configureTestingModule({
			imports: [FaqEditComponent],
			providers: [
				provideTranslateService(),
				provideFakeIcons(),
				provideNotificationMock(notifications),
				provideDialogMock(dialog),
				{provide: FaqItemsService, useValue: faqItemsService}
			]
		});
		TestBed.overrideComponent(FaqEditComponent, {remove: {imports: [FaqItemEditComponent]}, add: {imports: [FaqItemEditStubComponent]}});
		fixture = TestBed.createComponent(FaqEditComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('ajoute la question après confirmation puis réinitialise le formulaire', () => {
		editor().onChange(item);

		fixture.nativeElement.querySelector('mat-card-actions button').click();

		expect(dialog.open).toHaveBeenCalledWith(ConfirmDialogComponent, expect.objectContaining({data: expect.objectContaining({type: 'warning'})}));
		expect(faqItemsService.add).toHaveBeenCalledWith(item);
		expect(notifications.success).toHaveBeenCalledWith('add.question.answer.success');
		expect(component.addFaqItemFormGrp.value).toEqual({faqItem: null});
	});

	it('n’ajoute rien si la confirmation est refusée', () => {
		dialog.result = false;
		editor().onChange(item);

		component.submitFAQItem();

		expect(faqItemsService.add).not.toHaveBeenCalled();
		expect(component.addFaqItemFormGrp.value).toEqual({faqItem: item});
	});
});
