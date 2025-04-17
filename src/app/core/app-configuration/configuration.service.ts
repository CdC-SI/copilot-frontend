import {Inject, Injectable} from '@angular/core';
import {Configuration, ZCO_CONFIGURATIONS_TOKEN} from './configuration';
import {ObHttpApiInterceptorConfig, ObMasterLayoutConfig, WINDOW} from '@oblique/oblique';
import {NavigationEnd, Router} from '@angular/router';
import {AuthenticationService, LocalStorageService} from 'zas-design-system';

@Injectable({
	providedIn: 'root'
})
export class ConfigurationService {
	private envConfiguration: Configuration;

	constructor(
		@Inject(ZCO_CONFIGURATIONS_TOKEN) private readonly configurations: Configuration[],
		@Inject(WINDOW) private readonly window: Window,
		private readonly masterLayoutConfig: ObMasterLayoutConfig,
		private readonly router: Router,
		private readonly interceptorConfig: ObHttpApiInterceptorConfig,
		private readonly localStorageService: LocalStorageService,
		private readonly authenticationService: AuthenticationService
	) {}

	preInitialize() {
		this.loadConfigurationForEnv();
		this.configureMasterLayout();
		this.configureInterceptor();
		this.configureAuthentication();
	}

	configureAuthentication() {
		this.authenticationService.login();
	}

	loadConfigurationForEnv() {
		const windowLocation = this.window.location.href;
		const envConfiguration = this.configurations.find(e => e.patterns.find(pattern => windowLocation.search(pattern) >= 0));
		if (!envConfiguration) {
			throw new Error(`Environnement non trouvé pour ${windowLocation}!`);
		}
		this.envConfiguration = envConfiguration;
	}

	configureMasterLayout(): void {
		this.masterLayoutConfig.header.serviceNavigation.returnUrl = this.window.location.href;
		this.router.events.subscribe(event => {
			if (event instanceof NavigationEnd) {
				this.masterLayoutConfig.header.serviceNavigation.returnUrl = this.window.location.href;
			}
		});

		this.masterLayoutConfig.homePageRoute = '/chat';
		this.masterLayoutConfig.header.serviceNavigation.displayAuthentication = false;
		this.masterLayoutConfig.header.serviceNavigation.displayLanguages = true;
		this.masterLayoutConfig.header.serviceNavigation.displayProfile = false;
		this.masterLayoutConfig.header.serviceNavigation.displayInfo = false;
		this.masterLayoutConfig.header.serviceNavigation.displayMessage = false;
		this.masterLayoutConfig.header.serviceNavigation.displayApplications = false;
	}

	getEnvConfiguration(): Configuration {
		return this.envConfiguration;
	}

	backendApi(subPath: string): string {
		return `${this.envConfiguration.apiUrl}${subPath}`;
	}

	private configureInterceptor() {
		this.interceptorConfig.api.spinner = false;
		this.interceptorConfig.api.notification.active = false;
	}
}
