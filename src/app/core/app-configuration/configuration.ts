import {ObIBanner, ObIPamsConfiguration} from '@oblique/oblique/lib/utilities.model';
import {ObEPamsEnvironment} from '@oblique/oblique';
import {InjectionToken} from '@angular/core';

export interface Configuration {
	production: boolean;
	local: boolean;
	banner: ObIBanner;
	patterns: string[];
	pamsConfig?: ObIPamsConfiguration;
	apiUrl?: string;
	pamsAppId: string;
}

export const ZCO_CONFIGURATIONS_TOKEN = new InjectionToken('zco-configuration');

export const ZCO_CONFIGURATIONS: Configuration[] = [
	{
		patterns: ['localhost'],
		banner: {
			text: 'local'
		},
		pamsConfig: {
			environment: ObEPamsEnvironment.DEV,
			rootUrl: 'http://localhost:8208/'
		},
		pamsAppId: '301470',
		production: false,
		local: true,
		apiUrl: '/copilot/api'
	},
	{
		patterns: ['-d.zas.admin.ch'],
		banner: {
			text: 'DEV'
		},
		pamsConfig: {
			environment: ObEPamsEnvironment.REF,
			rootUrl: '/pams/'
		},
		pamsAppId: '301470',
		production: false,
		local: false,
		apiUrl: '/copilot/api'
	},
	{
		patterns: ['-r.zas.admin.ch'],
		banner: {
			text: 'REF'
		},
		pamsConfig: {
			environment: ObEPamsEnvironment.REF,
			rootUrl: '/pams/'
		},
		pamsAppId: '301470',
		production: false,
		local: false,
		apiUrl: '/copilot/api'
	},
	{
		patterns: ['-a.zas.admin.ch'],
		banner: {
			text: 'AQ'
		},
		pamsConfig: {
			environment: ObEPamsEnvironment.ABN,
			rootUrl: '/pams/'
		},
		pamsAppId: '301470',
		production: false,
		local: false,
		apiUrl: '/copilot/api'
	}
];
