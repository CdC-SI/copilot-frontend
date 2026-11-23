import {Provider} from '@angular/core';
import {TranslateService} from '@ngx-translate/core';
import {ObNotificationService} from '@oblique/oblique';

/** Notifications Oblique espionnées. */
export interface NotificationMock {
	success: jest.Mock;
	info: jest.Mock;
	warning: jest.Mock;
	error: jest.Mock;
}

export function notificationMock(): NotificationMock {
	return {success: jest.fn(), info: jest.fn(), warning: jest.fn(), error: jest.fn()};
}

/** `TranslateService` minimal : `instant` renvoie la clé, langue courante `lang`. */
export function provideTranslateStub(lang = 'fr'): Provider {
	return {
		provide: TranslateService,
		useValue: {instant: (key: string) => key, getCurrentLang: () => lang, currentLang: lang}
	};
}

export function provideNotificationMock(mock: NotificationMock = notificationMock()): Provider {
	return {provide: ObNotificationService, useValue: mock};
}
