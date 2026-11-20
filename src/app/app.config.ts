import {ApplicationConfig, ErrorHandler, LOCALE_ID, inject, provideAppInitializer, provideZoneChangeDetection} from '@angular/core';
import {provideRouter} from '@angular/router';
import {HTTP_INTERCEPTORS, provideHttpClient, withInterceptorsFromDi, withXhr} from '@angular/common/http';
import {registerLocaleData} from '@angular/common';
import localeDECH from '@angular/common/locales/de-CH';
import localeFRCH from '@angular/common/locales/fr-CH';
import localeITCH from '@angular/common/locales/it-CH';
import {OB_BANNER, ObHttpApiInterceptor, provideObliqueConfiguration} from '@oblique/oblique';
import {provideMarkdown} from 'ngx-markdown';
import {routes} from './app.routes';
import {ZCO_CONFIGURATIONS, ZCO_CONFIGURATIONS_TOKEN} from './core/app-configuration/configuration';
import {ConfigurationService} from './core/app-configuration/configuration.service';
import {BlueGatewayInterceptorV2} from './shared/interceptors/blue-gateway-interceptor-v2.service';
import {GlobalErrorHandler} from './core/global-error-handler';

registerLocaleData(localeDECH);
registerLocaleData(localeFRCH);
registerLocaleData(localeITCH);

export const appConfig: ApplicationConfig = {
	providers: [
		// Angular 22 est zoneless par défaut : l'application repose encore sur zone.js (pages `Eager`).
		provideZoneChangeDetection(),
		provideRouter(routes),
		// withXhr() : requis pour que les intercepteurs Oblique voient les requêtes.
		provideHttpClient(withXhr(), withInterceptorsFromDi()),
		{provide: HTTP_INTERCEPTORS, useClass: ObHttpApiInterceptor, multi: true},
		{provide: HTTP_INTERCEPTORS, useClass: BlueGatewayInterceptorV2, multi: true},
		provideObliqueConfiguration({
			accessibilityStatement: {
				createdOn: new Date('2026-11-18'),
				applicationName: 'ZIA',
				conformity: 'none',
				applicationOperator: 'Centrale de compensation (CdC), Genève',
				contact: [{phone: '+41 58 461 91 11'}]
			}
		}),
		{provide: OB_BANNER, useFactory: () => inject(ConfigurationService).getEnvConfiguration().banner},
		provideMarkdown(),
		{provide: ZCO_CONFIGURATIONS_TOKEN, useValue: ZCO_CONFIGURATIONS},
		{provide: LOCALE_ID, useValue: 'fr-CH'},
		provideAppInitializer(() => inject(ConfigurationService).preInitialize()),
		{provide: ErrorHandler, useClass: GlobalErrorHandler}
	]
};
