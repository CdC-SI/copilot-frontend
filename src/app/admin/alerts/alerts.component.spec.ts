import {ComponentFixture, TestBed} from '@angular/core/testing';
import {provideNativeDateAdapter} from '@angular/material/core';
import {TranslateService, provideTranslateService} from '@ngx-translate/core';
import {of, throwError} from 'rxjs';
import {DialogMock, dialogMock, provideDialogMock, provideFakeIcons, refresh} from '../../../testing/admin';
import {NotificationMock, notificationMock, provideNotificationMock} from '../../../testing/angular';
import {AlertView} from '../../shared/model/alerts';
import {AlertsService} from '../../shared/services/alert.service';
import {AlertsComponent} from './alerts.component';
import {ReactivateDialogComponent} from './reactivate-dialog/reactivate-dialog.component';

const anAlert = (alert: Partial<AlertView> = {}): AlertView => ({
	id: 1,
	level: 'INFO',
	textFr: 'Maintenance ce soir',
	textDe: 'Wartung heute Abend',
	textIt: null,
	expiresAt: '2099-01-01T08:00:00',
	active: true,
	...alert
});

describe('AlertsComponent', () => {
	let fixture: ComponentFixture<AlertsComponent>;
	let component: AlertsComponent;
	let notifications: NotificationMock;
	let dialog: DialogMock;
	let alertsService: {getAlerts: jest.Mock; createAlert: jest.Mock; setExpiration: jest.Mock; deleteAlert: jest.Mock};
	const active = anAlert();
	const expired = anAlert({id: 2, level: 'WARNING', textFr: '  ', expiresAt: '2025-12-31T23:59:00', active: false});
	const element = (): HTMLElement => fixture.nativeElement;
	const tables = (): HTMLTableElement[] => Array.from(element().querySelectorAll<HTMLTableElement>('table'));
	const rows = (table: number): HTMLTableRowElement[] => Array.from(tables()[table].querySelectorAll<HTMLTableRowElement>('tr.mat-mdc-row'));
	const cells = (row: HTMLTableRowElement): string[] => Array.from(row.querySelectorAll('td')).map(cell => cell.textContent?.trim() ?? '');
	const createButton = (): HTMLButtonElement => element().querySelector<HTMLButtonElement>('.actions button');

	beforeEach(() => {
		notifications = notificationMock();
		dialog = dialogMock();
		alertsService = {
			getAlerts: jest.fn(() => of([active, expired])),
			createAlert: jest.fn(() => of(active)),
			setExpiration: jest.fn(() => of(active)),
			deleteAlert: jest.fn(() => of(undefined))
		};
		TestBed.configureTestingModule({
			imports: [AlertsComponent],
			providers: [
				provideTranslateService(),
				provideNativeDateAdapter(),
				provideFakeIcons(),
				provideNotificationMock(notifications),
				provideDialogMock(dialog),
				{provide: AlertsService, useValue: alertsService}
			]
		});
		fixture = TestBed.createComponent(AlertsComponent);
		component = fixture.componentInstance;
		refresh(fixture);
	});

	it('sépare les alertes actives et expirées', () => {
		expect(rows(0).map(cells)).toEqual([['INFO', 'Maintenance ce soir', '2099-01-01 08:00', '']]);
		expect(rows(1).map(cells)).toEqual([['WARNING', 'alert.default.text', '2025-12-31 23:59', '']]);
	});

	it('affiche le texte de la langue courante, ou le texte par défaut', () => {
		const translate = TestBed.inject(TranslateService);

		translate.use('de-CH');
		refresh(fixture);
		expect(cells(rows(0)[0])[1]).toBe('Wartung heute Abend');

		translate.use('it');
		expect(component.currentText(active)).toBe('alert.default.text');
		translate.use('en');
		expect(component.currentText(active)).toBe('Maintenance ce soir');
	});

	it('indique une alerte sans échéance', () => {
		alertsService.getAlerts.mockReturnValue(of([anAlert({expiresAt: null})]));

		component.reload();
		refresh(fixture);

		expect(cells(rows(0)[0])[2]).toBe('admin.alerts.noexpiry');
		expect(rows(1)).toHaveLength(0);
	});

	it('crée une alerte avec ses textes et son échéance, puis réinitialise le formulaire', () => {
		expect(element().querySelector('.default-hint')).not.toBeNull();
		component.form.patchValue({level: 'WARNING', textFr: ' Panne ', textDe: '', date: new Date(2026, 2, 1), time: '08:30'});
		refresh(fixture);
		expect(element().querySelector('.default-hint')).toBeNull();

		createButton().click();

		expect(alertsService.createAlert).toHaveBeenCalledWith({level: 'WARNING', textFr: 'Panne', textDe: null, textIt: null, expiresAt: '2026-03-01T08:30:00'});
		expect(notifications.success).toHaveBeenCalledWith('admin.alerts.create.success');
		expect(component.form.value).toEqual({level: 'INFO', textFr: '', textDe: '', textIt: '', date: null, time: ''});
		expect(alertsService.getAlerts).toHaveBeenCalledTimes(2);
	});

	it('crée une alerte sans échéance ou jusqu’à la fin de la journée', () => {
		component.create();
		expect(alertsService.createAlert).toHaveBeenLastCalledWith(expect.objectContaining({level: 'INFO', textFr: null, expiresAt: null}));

		component.form.patchValue({date: new Date(2026, 2, 1)});
		component.create();
		expect(alertsService.createAlert).toHaveBeenLastCalledWith(expect.objectContaining({expiresAt: '2026-03-01T23:59:00'}));
	});

	it('refuse une heure invalide', () => {
		component.form.patchValue({time: '24:00'});
		component.form.markAllAsTouched();
		refresh(fixture);

		expect(createButton().disabled).toBe(true);
		component.create();
		expect(alertsService.createAlert).not.toHaveBeenCalled();
	});

	it('réactive une alerte expirée avec la nouvelle échéance choisie', () => {
		dialog.result = '2026-06-30T12:00:00';

		rows(1)[0].querySelectorAll('button')[0].click();

		expect(dialog.open).toHaveBeenCalledWith(ReactivateDialogComponent, {width: '500px', data: {current: '2025-12-31T23:59:00'}});
		expect(alertsService.setExpiration).toHaveBeenCalledWith(2, '2026-06-30T12:00:00');
		expect(notifications.success).toHaveBeenCalledWith('admin.alerts.reactivate.success');
		expect(alertsService.getAlerts).toHaveBeenCalledTimes(2);
	});

	it('ne réactive rien si la modale est annulée', () => {
		dialog.result = null;

		component.reactivate(expired);

		expect(alertsService.setExpiration).not.toHaveBeenCalled();
	});

	it('supprime une alerte', () => {
		rows(0)[0].querySelector('button')?.click();

		expect(alertsService.deleteAlert).toHaveBeenCalledWith(1);
		expect(notifications.success).toHaveBeenCalledWith('admin.alerts.delete.success');
		expect(alertsService.getAlerts).toHaveBeenCalledTimes(2);
	});

	it('notifie les échecs', () => {
		alertsService.getAlerts.mockReturnValue(throwError(() => new Error('500')));
		alertsService.createAlert.mockReturnValue(throwError(() => new Error('500')));
		alertsService.setExpiration.mockReturnValue(throwError(() => new Error('500')));
		alertsService.deleteAlert.mockReturnValue(throwError(() => new Error('500')));
		dialog.result = '2026-06-30T12:00:00';

		component.reload();
		component.create();
		component.reactivate(expired);
		component.delete(active);

		expect(notifications.error.mock.calls.map(([key]) => key)).toEqual([
			'admin.alerts.load.error',
			'admin.alerts.create.error',
			'admin.alerts.reactivate.error',
			'admin.alerts.delete.error'
		]);
	});
});
