import {APP_INITIALIZER, LOCALE_ID, NgModule} from '@angular/core';
import {BrowserModule} from '@angular/platform-browser';

import {AppRoutingModule} from './app-routing.module';
import {AppComponent} from './app.component';
import {
	OB_BANNER,
	ObButtonModule,
	ObExternalLinkModule,
	ObHttpApiInterceptor,
	ObIconModule,
	ObMasterLayoutModule,
	multiTranslateLoader
} from '@oblique/oblique';
import {BrowserAnimationsModule} from '@angular/platform-browser/animations';
import {registerLocaleData} from '@angular/common';
import localeDECH from '@angular/common/locales/de-CH';
import localeFRCH from '@angular/common/locales/fr-CH';
import localeITCH from '@angular/common/locales/it-CH';
import {HTTP_INTERCEPTORS, HttpClientModule} from '@angular/common/http';
import {TranslateModule} from '@ngx-translate/core';
import {ChatComponent} from './chat/chat.component';
import {TipsComponent} from './tips/tips.component';
import {ConfigurationService} from './core/app-configuration/configuration.service';
import {ZCO_CONFIGURATIONS, ZCO_CONFIGURATIONS_TOKEN} from './core/app-configuration/configuration';
import {SharedModule} from './shared/shared.module';
import {AdminComponent} from './admin/admin.component';
import {BlueGatewayInterceptorV2} from './shared/interceptors/blue-gateway-interceptor-v2.service';
import {MatProgressBar} from '@angular/material/progress-bar';

registerLocaleData(localeDECH);
registerLocaleData(localeFRCH);
registerLocaleData(localeITCH);

function appInitializerFactory(configurationService: ConfigurationService) {
	return () => configurationService.preInitialize();
}

function bannerFactory(configurationService: ConfigurationService) {
	return configurationService.getEnvConfiguration().banner;
}

@NgModule({
	declarations: [AppComponent, ChatComponent, AdminComponent, TipsComponent],
	imports: [
		BrowserModule,
		AppRoutingModule,
		ObMasterLayoutModule,
		BrowserAnimationsModule,
		ObButtonModule,
		ObIconModule.forRoot(),
		HttpClientModule,
		TranslateModule.forRoot(multiTranslateLoader()),
		ObExternalLinkModule,
		SharedModule,
		MatProgressBar
	],
	providers: [
		{provide: ZCO_CONFIGURATIONS_TOKEN, useValue: ZCO_CONFIGURATIONS},
		{provide: LOCALE_ID, useValue: 'de-CH'},
		{provide: APP_INITIALIZER, useFactory: appInitializerFactory, deps: [ConfigurationService], multi: true},
		{provide: OB_BANNER, useFactory: bannerFactory, deps: [ConfigurationService]},
		{provide: HTTP_INTERCEPTORS, useClass: ObHttpApiInterceptor, multi: true},
		{provide: HTTP_INTERCEPTORS, useClass: BlueGatewayInterceptorV2, multi: true}
	],
	bootstrap: [AppComponent]
})
export class AppModule {}
