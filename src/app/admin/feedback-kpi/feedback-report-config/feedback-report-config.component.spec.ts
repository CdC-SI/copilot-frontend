import {TestKey} from '@angular/cdk/testing';
import {TestbedHarnessEnvironment} from '@angular/cdk/testing/testbed';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {MatChipEditedEvent, MatChipInputEvent} from '@angular/material/chips';
import {MatChipGridHarness} from '@angular/material/chips/testing';
import {provideTranslateService} from '@ngx-translate/core';
import {of, throwError} from 'rxjs';
import {provideFakeIcons, refresh} from '../../../../testing/admin';
import {NotificationMock, notificationMock, provideNotificationMock} from '../../../../testing/angular';
import {FeedbackReportConfig} from '../../../shared/model/feedback';
import {FeedbackService} from '../../../shared/services/feedback.service';
import {FeedbackReportConfigComponent} from './feedback-report-config.component';

describe('FeedbackReportConfigComponent', () => {
	let fixture: ComponentFixture<FeedbackReportConfigComponent>;
	let component: FeedbackReportConfigComponent;
	let notifications: NotificationMock;
	let service: {getReportConfig: jest.Mock; updateReportConfig: jest.Mock};
	const config = (): FeedbackReportConfig => ({
		enabled: true,
		cronExpression: '0 0 8 * * MON',
		zoneId: 'Europe/Zurich',
		recipients: ['ada@zas.admin.ch'],
		lookbackDays: 7
	});
	const element = (): HTMLElement => fixture.nativeElement;
	const saveButton = (): HTMLButtonElement | null => element().querySelector<HTMLButtonElement>('.actions button');
	const chipEvent = (value: string): MatChipInputEvent => ({value, chipInput: {clear: jest.fn()}}) as unknown as MatChipInputEvent;

	const setup = (): void => {
		fixture = TestBed.createComponent(FeedbackReportConfigComponent);
		component = fixture.componentInstance;
		refresh(fixture);
	};

	beforeEach(() => {
		notifications = notificationMock();
		service = {getReportConfig: jest.fn(() => of(config())), updateReportConfig: jest.fn((updated: FeedbackReportConfig) => of(updated))};
		TestBed.configureTestingModule({
			imports: [FeedbackReportConfigComponent],
			providers: [provideTranslateService(), provideFakeIcons(), provideNotificationMock(notifications), {provide: FeedbackService, useValue: service}]
		});
	});

	it('affiche la configuration chargée avec ses destinataires', async () => {
		setup();
		const grid = await TestbedHarnessEnvironment.loader(fixture).getHarness(MatChipGridHarness);

		const rows = await grid.getRows();
		expect(await Promise.all(rows.map(async row => row.getText()))).toEqual(['ada@zas.admin.ch']);
		expect(component.form.value).toEqual(config());
		expect(saveButton()?.disabled).toBe(false);
	});

	it('ajoute, renomme et retire des destinataires', async () => {
		setup();
		const grid = await TestbedHarnessEnvironment.loader(fixture).getHarness(MatChipGridHarness);
		const input = await grid.getInput();

		await input?.setValue('  bob@zas.admin.ch ');
		await input?.sendSeparatorKey(TestKey.ENTER);
		expect(component.recipients).toEqual(['ada@zas.admin.ch', 'bob@zas.admin.ch']);
		expect(component.recipientsCtrl.dirty).toBe(true);

		component.editRecipient('bob@zas.admin.ch', {value: 'carl@zas.admin.ch'} as MatChipEditedEvent);
		expect(component.recipients).toEqual(['ada@zas.admin.ch', 'carl@zas.admin.ch']);

		component.editRecipient('carl@zas.admin.ch', {value: '  '} as MatChipEditedEvent);
		expect(component.recipients).toEqual(['ada@zas.admin.ch']);

		await (await grid.getRows())[0].remove();
		expect(component.recipients).toEqual([]);
		expect(saveButton()?.disabled).toBe(true);
	});

	it('ignore un destinataire vide', () => {
		setup();
		const event = chipEvent('   ');

		component.addRecipient(event);
		component.removeRecipient('inconnu@zas.admin.ch');

		expect(component.recipients).toEqual(['ada@zas.admin.ch']);
		expect(event.chipInput.clear).toHaveBeenCalled();
	});

	it('enregistre la configuration et reprend la réponse du serveur', () => {
		service.updateReportConfig.mockReturnValue(of({...config(), recipients: ['ada@zas.admin.ch', 'bob@zas.admin.ch'], lookbackDays: 14}));
		setup();
		component.addRecipient(chipEvent('bob@zas.admin.ch'));

		saveButton()?.click();
		refresh(fixture);

		expect(service.updateReportConfig).toHaveBeenCalledWith({...config(), recipients: ['ada@zas.admin.ch', 'bob@zas.admin.ch']});
		expect(notifications.success).toHaveBeenCalledWith('admin.feedbackReport.save.success');
		expect(component.form.value.lookbackDays).toBe(14);
		expect(component.isSaving).toBe(false);
	});

	it('n’enregistre pas une configuration incomplète', () => {
		setup();
		component.form.patchValue({cronExpression: ''});
		refresh(fixture);

		component.save();
		refresh(fixture);

		expect(service.updateReportConfig).not.toHaveBeenCalled();
		expect(element().textContent).toContain('admin.feedbackReport.required');
	});

	it('notifie les échecs de chargement et d’enregistrement', () => {
		service.getReportConfig.mockReturnValue(throwError(() => new Error('500')));
		setup();
		expect(notifications.error).toHaveBeenCalledWith('admin.feedbackReport.load.error');
		expect(component.isLoading).toBe(false);

		component.form.patchValue(config());
		component.recipients = ['ada@zas.admin.ch'];
		service.updateReportConfig.mockReturnValue(throwError(() => new Error('500')));
		component.save();

		expect(notifications.error).toHaveBeenCalledWith('admin.feedbackReport.save.error');
		expect(component.isSaving).toBe(false);
	});
});
