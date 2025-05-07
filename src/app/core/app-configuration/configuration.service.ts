import {Inject, Injectable} from '@angular/core';
import {Configuration, ZCO_CONFIGURATIONS_TOKEN} from './configuration';
import {ObHttpApiInterceptorConfig, ObMasterLayoutConfig, WINDOW} from '@oblique/oblique';
import {NavigationEnd, Router} from '@angular/router';
import {EnvironmentService} from 'zas-design-system';
import {BehaviorSubject, firstValueFrom, map, mergeMap, of, switchMap, tap} from 'rxjs';
import {MOCK_USER_TOKEN} from './token';
import {AuthenticationServiceV2} from '../../shared/services/auth.service';
import {UserService} from '../../shared/services/user.service';
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
		this.environmentService.setEnvironmentConfigs([
			{matchUrlRegex: '^http[s]?://localhost.*', gatewayUrl: 'http://localhost:9998'},
			{matchUrlRegex: '^https://.*copilot-d\\..*', gatewayUrl: 'https://gateway-d.zas.admin.ch'},
			{matchUrlRegex: '^https://.*copilot-r\\..*', gatewayUrl: 'https://gateway-r.zas.admin.ch'},
			{matchUrlRegex: '^https://.*copilot-a\\..*', gatewayUrl: 'https://gateway-a.zas.admin.ch'},
			{matchUrlRegex: '^https://.*copilot\\..*', gatewayUrl: 'https://gateway.zas.admin.ch'}
		]);
		this.environmentService.setMockToken(MOCK_USER_TOKEN);
		this.environmentService.isLocalhostEnvironment(this.envConfiguration.local);

		void firstValueFrom(
			this.environmentService.load().pipe(
				mergeMap(env => {
					if (!this.envConfiguration.local) {
						this.authenticationService.login();
						return this.authenticationService.getFullToken().pipe(
							switchMap(() =>
								this.getUser().pipe(
									map(user => {
										this.authenticationService.$authenticatedUser.next(user);
										return env;
									})
								)
							)
						);
					}
					return this.getUser().pipe(
						map(user => {
							this.authenticationService.$authenticatedUser.next(user);
							return env;
						})
					);
				})
			)
		);
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

	private getUser() {
		return this.http.get<IUser>(this.backendApi('/users/authenticated'));
	}
}
