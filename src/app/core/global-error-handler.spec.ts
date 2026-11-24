import {HttpErrorResponse} from '@angular/common/http';
import {TestBed} from '@angular/core/testing';
import {NotificationMock, notificationMock, provideNotificationMock} from '../../testing/angular';
import {GlobalErrorHandler} from './global-error-handler';

describe('GlobalErrorHandler', () => {
	let handler: GlobalErrorHandler;
	let notif: NotificationMock;

	beforeEach(() => {
		notif = notificationMock();
		jest.spyOn(console, 'error').mockImplementation(() => undefined);
		TestBed.configureTestingModule({providers: [GlobalErrorHandler, provideNotificationMock(notif)]});
		handler = TestBed.inject(GlobalErrorHandler);
	});

	afterEach(() => jest.restoreAllMocks());

	it('logge et notifie une erreur applicative', () => {
		const error = new Error('boum');

		handler.handleError(error);

		expect(console.error).toHaveBeenCalledWith(error);
		expect(notif.error).toHaveBeenCalledWith('i18n.oblique.http.error.general');
	});

	it.each([
		['directe', new HttpErrorResponse({status: 500})],
		['dans une promesse rejetée', {rejection: new HttpErrorResponse({status: 500})}]
	])('ne fait que logger une erreur HTTP %s (déjà notifiée par l’intercepteur)', (_, error) => {
		handler.handleError(error);

		expect(console.error).toHaveBeenCalledWith(error);
		expect(notif.error).not.toHaveBeenCalled();
	});

	it('supporte une erreur nulle', () => {
		handler.handleError(null);

		expect(notif.error).toHaveBeenCalled();
	});
});
