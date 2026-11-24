import {EnvironmentProviders, Provider} from '@angular/core';
import {provideHttpClient} from '@angular/common/http';
import {provideHttpClientTesting} from '@angular/common/http/testing';
import {ConfigurationService} from '../app/core/app-configuration/configuration.service';
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

/** Préfixe des URL d'API renvoyées par `ConfigurationService.backendApi` dans les tests. */
export const TEST_API = '/zia/api';

/**
 * `HttpClient` de test (`HttpTestingController`) et `ConfigurationService` réduit à `backendApi`
 * (préfixe `TEST_API`) : de quoi tester un service d'API sans configuration d'environnement.
 */
export function provideApiTesting(): (Provider | EnvironmentProviders)[] {
	return [provideHttpClient(), provideHttpClientTesting(), {provide: ConfigurationService, useValue: {backendApi: (path: string) => `${TEST_API}${path}`}}];
}
