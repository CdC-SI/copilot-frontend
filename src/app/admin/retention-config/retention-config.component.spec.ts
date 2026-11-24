import {ComponentFixture, TestBed} from '@angular/core/testing';
import {provideTranslateService} from '@ngx-translate/core';
import {Subject, of, throwError} from 'rxjs';
import {provideFakeIcons, refresh} from '../../../testing/admin';
import {NotificationMock, notificationMock, provideNotificationMock} from '../../../testing/angular';
import {DocumentRetentionConfig} from '../../shared/model/document-retention-config';
import {RetentionConfigService} from '../../shared/services/retention-config.service';
import {RetentionConfigComponent} from './retention-config.component';

describe('RetentionConfigComponent', () => {
	let fixture: ComponentFixture<RetentionConfigComponent>;
	let component: RetentionConfigComponent;
	let notifications: NotificationMock;
	let service: {get: jest.Mock; update: jest.Mock};
	const config: DocumentRetentionConfig = {daysBeforeArchival: 30, daysBeforeDeletion: 60};
	const element = (): HTMLElement => fixture.nativeElement;
	const inputs = (): HTMLInputElement[] => Array.from(element().querySelectorAll<HTMLInputElement>('input'));
	const saveButton = (): HTMLButtonElement | null => element().querySelector<HTMLButtonElement>('.actions button');
	const type = (input: HTMLInputElement, value: string): void => {
		input.value = value;
		input.dispatchEvent(new Event('input'));
		input.dispatchEvent(new Event('blur'));
		refresh(fixture);
	};

	const setup = (): void => {
		fixture = TestBed.createComponent(RetentionConfigComponent);
		component = fixture.componentInstance;
		refresh(fixture);
	};

	beforeEach(() => {
		notifications = notificationMock();
		service = {get: jest.fn(() => of(config)), update: jest.fn((updated: DocumentRetentionConfig) => of(updated))};
		TestBed.configureTestingModule({
			imports: [RetentionConfigComponent],
			providers: [provideTranslateService(), provideFakeIcons(), provideNotificationMock(notifications), {provide: RetentionConfigService, useValue: service}]
		});
	});

	it('affiche un indicateur pendant le chargement puis la configuration', () => {
		const config$ = new Subject<DocumentRetentionConfig>();
		service.get.mockReturnValue(config$);
		setup();
		expect(element().querySelector('mat-spinner')).not.toBeNull();
		expect(element().querySelector('form')).toBeNull();

		config$.next(config);
		refresh(fixture);

		expect(element().querySelector('mat-spinner')).toBeNull();
		expect(inputs().map(input => input.value)).toEqual(['30', '60']);
	});

	it('enregistre la configuration modifiée', () => {
		setup();

		type(inputs()[1], '90');
		saveButton()?.click();
		refresh(fixture);

		expect(service.update).toHaveBeenCalledWith({daysBeforeArchival: 30, daysBeforeDeletion: 90});
		expect(notifications.success).toHaveBeenCalledWith('admin.retention.save.success');
		expect(component.isSaving).toBe(false);
	});

	it('refuse une durée inférieure à un jour ou vide', () => {
		setup();

		type(inputs()[0], '0');
		expect(saveButton()?.disabled).toBe(true);
		expect(element().textContent).toContain('admin.retention.min');

		type(inputs()[0], '');
		component.save();
		refresh(fixture);

		expect(service.update).not.toHaveBeenCalled();
		expect(component.form.touched).toBe(true);
		expect(element().textContent).toContain('admin.retention.required');
	});

	it('notifie les échecs de chargement et d’enregistrement', () => {
		service.get.mockReturnValue(throwError(() => new Error('500')));
		setup();
		expect(notifications.error).toHaveBeenCalledWith('admin.retention.load.error');
		expect(component.isLoading).toBe(false);

		component.form.setValue(config);
		service.update.mockReturnValue(throwError(() => new Error('500')));
		component.save();

		expect(notifications.error).toHaveBeenCalledWith('admin.retention.save.error');
		expect(component.isSaving).toBe(false);
	});
});
