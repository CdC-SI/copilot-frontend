import {HttpTestingController} from '@angular/common/http/testing';
import {TestBed} from '@angular/core/testing';
import {TEST_API, provideApiTesting} from '../../../testing/angular';
import {AlertView} from '../model/alerts';
import {AlertsService, toLocalDateTimeString} from './alert.service';

describe('AlertsService', () => {
	let service: AlertsService;
	let http: HttpTestingController;

	beforeEach(() => {
		jest.useFakeTimers({now: new Date('2026-03-10T12:00:00')});
		TestBed.configureTestingModule({providers: provideApiTesting()});
		service = TestBed.inject(AlertsService);
		http = TestBed.inject(HttpTestingController);
	});

	afterEach(() => {
		http.verify();
		jest.useRealTimers();
	});

	it('marque comme actives les alertes sans expiration ou qui expirent plus tard', () => {
		let alerts: AlertView[] = [];
		service.getAlerts().subscribe(result => (alerts = result));

		http.expectOne(`${TEST_API}/alerts/all`).flush([
			{id: 1, expiresAt: null},
			{id: 2, expiresAt: '2026-03-11T00:00:00'},
			{id: 3, expiresAt: '2026-03-09T23:59:00'}
		]);

		expect(alerts.map(a => [a.id, a.active])).toEqual([
			[1, true],
			[2, true],
			[3, false]
		]);
	});

	it('appelle les routes des alertes', () => {
		service.getActiveAlerts().subscribe();
		service.createAlert({} as never).subscribe();
		service.setExpiration(4, null).subscribe();
		service.deleteAlert(4).subscribe();

		expect(http.expectOne(`${TEST_API}/alerts/active`).request.method).toBe('GET');
		expect(http.expectOne(`${TEST_API}/alerts`).request.method).toBe('POST');
		const [update, remove] = http.match(`${TEST_API}/alerts/4`);
		expect(update.request.method).toBe('PUT');
		expect(update.request.body).toEqual({expiresAt: null});
		expect(remove.request.method).toBe('DELETE');
	});

	it('formate une date locale sans fuseau', () => {
		expect(toLocalDateTimeString(new Date(2025, 9, 6, 8, 5, 3))).toBe('2025-10-06T08:05:03');
	});
});
