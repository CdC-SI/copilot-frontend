import {Inject, Injectable} from '@angular/core';
import {Configuration, ZCO_CONFIGURATIONS_TOKEN} from './configuration';
import {ObHttpApiInterceptorConfig, ObMasterLayoutConfig, WINDOW} from '@oblique/oblique';
import {NavigationEnd, Router} from '@angular/router';
import {EnvironmentConfig, EnvironmentService} from 'zas-design-system';
import {firstValueFrom, map, mergeMap, switchMap} from 'rxjs';
import {MOCK_USER_TOKEN} from './token';
import {AuthenticationServiceV2} from '../../shared/services/auth.service';
import {IUser} from '../../shared/model/user';
import {HttpClient} from '@angular/common/http';

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
		private readonly authenticationService: AuthenticationServiceV2,
		private readonly environmentService: EnvironmentService,
		private readonly http: HttpClient
	) {}

	preInitialize() {
		this.loadConfigurationForEnv();
		this.configureMasterLayout();
		this.configureInterceptor();
		return this.configureAuthentication();
	}

	configureAuthentication() {
		this.setupEnvironmentConfigs();
		this.setupAuthenticationTokens();
		firstValueFrom(this.environmentService.load().pipe(mergeMap(env => this.handleAuthenticationFlow(env)))).catch(error => {
			console.error("Erreur lors de l'initialisation de l'authentification", error);
		});
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

	private setupEnvironmentConfigs() {
		this.environmentService.setEnvironmentConfigs([
			{matchUrlRegex: '^http[s]?://localhost.*', gatewayUrl: 'http://localhost:9998'},
			{matchUrlRegex: '^https://.*copilot-d\\..*', gatewayUrl: 'https://gateway-d.zas.admin.ch'},
			{matchUrlRegex: '^https://.*copilot-r\\..*', gatewayUrl: 'https://gateway-r.zas.admin.ch'},
			{matchUrlRegex: '^https://.*copilot-a\\..*', gatewayUrl: 'https://gateway-a.zas.admin.ch'},
			{matchUrlRegex: '^https://.*copilot\\..*', gatewayUrl: 'https://gateway.zas.admin.ch'}
		]);
	}

	private setupAuthenticationTokens() {
		this.environmentService.setMockToken(MOCK_USER_TOKEN);
		this.authenticationService.jwtToken = MOCK_USER_TOKEN;
		this.environmentService.isLocalhostEnvironment(this.envConfiguration.local);
	}

	private handleAuthenticationFlow(env: EnvironmentConfig) {
		if (!this.envConfiguration.local) {
			this.authenticationService.login();
			return this.authenticateAndLoadUser(env);
		}
		return this.loadUserAndReturn(env);
	}

	private authenticateAndLoadUser(env: EnvironmentConfig) {
		return this.authenticationService.getFullToken().pipe(switchMap(() => this.loadUserAndReturn(env)));
	}

	private loadUserAndReturn(env: EnvironmentConfig) {
		return this.getUser().pipe(
			map(user => {
				this.authenticationService.$authenticatedUser.next(user);
				return env;
			})
		);
	}

	private configureInterceptor() {
		this.interceptorConfig.api.spinner = false;
		this.interceptorConfig.api.notification.active = false;
	}

	private getUser() {
		return this.http.get<IUser>(this.backendApi('/users/authenticated'));
	}
}
