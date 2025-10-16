import {APP_INITIALIZER, LOCALE_ID, NgModule} from '@angular/core';
import {BrowserModule} from '@angular/platform-browser';

import {AppRoutingModule} from './app-routing.module';
import {AppComponent} from './app.component';
import {
	OB_BANNER,
	OB_PAMS_CONFIGURATION,
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
import {MatProgressBar} from '@angular/material/progress-bar';
import {AuthenticationInterceptor} from './shared/interceptors/authentication-interceptor';
import {ToolsHomeComponent} from './tools/tools-home/tools-home.component';
import {DocumentAnalysisComponent} from './tools/document-analysis/document-analysis.component';
import {IdentityCheckComponent} from './tools/identity-check/identity-check.component';
import {FeedbackKpiComponent} from './admin/feedback-kpi/feedback-kpi.component';
import {MatButtonToggle, MatButtonToggleGroup} from '@angular/material/button-toggle';
import {FeedbackDetailDialogComponent} from './admin/feedback-kpi/feedback-detail-dialog/feedback-detail-dialog.component';
import {BaseChartDirective} from 'ng2-charts';
import {DocumentFeedbackDetailDialogComponent} from './admin/feedback-kpi/document-feedback-detail-dialog/document-feedback-detail-dialog.component';
import {FaqEditComponent} from './admin/faq-edit/faq-edit.component';
import {UserAccountsComponent} from './admin/user-accounts/user-accounts.component';
import {DocUploadComponent} from './admin/doc-upload/doc-upload.component';

registerLocaleData(localeDECH);
registerLocaleData(localeFRCH);
registerLocaleData(localeITCH);

function appInitializerFactory(configurationService: ConfigurationService) {
	return () => configurationService.preInitialize();
}

function bannerFactory(configurationService: ConfigurationService) {
	return configurationService.getEnvConfiguration().banner;
}

function pamsFactory(configurationService: ConfigurationService) {
	return configurationService.getEnvConfiguration().pamsConfig;
}

@NgModule({
	declarations: [
		AppComponent,
		ChatComponent,
		AdminComponent,
		TipsComponent,
		ToolsHomeComponent,
		DocumentAnalysisComponent,
		IdentityCheckComponent,
		FeedbackKpiComponent,
		FeedbackDetailDialogComponent,
		DocumentFeedbackDetailDialogComponent,
		FaqEditComponent,
		UserAccountsComponent,
		DocUploadComponent
	],
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
		MatProgressBar,
		MatButtonToggleGroup,
		MatButtonToggle,
		BaseChartDirective
	],
	providers: [
		{provide: ZCO_CONFIGURATIONS_TOKEN, useValue: ZCO_CONFIGURATIONS},
		{provide: LOCALE_ID, useValue: 'fr-CH'},
		{provide: APP_INITIALIZER, useFactory: appInitializerFactory, deps: [ConfigurationService], multi: true},
		{provide: OB_BANNER, useFactory: bannerFactory, deps: [ConfigurationService]},
		{provide: OB_PAMS_CONFIGURATION, useFactory: pamsFactory, deps: [ConfigurationService]},
		{provide: HTTP_INTERCEPTORS, useClass: ObHttpApiInterceptor, multi: true},
		{provide: HTTP_INTERCEPTORS, useClass: AuthenticationInterceptor, multi: true}
	],
	bootstrap: [AppComponent]
})
export class AppModule {}
