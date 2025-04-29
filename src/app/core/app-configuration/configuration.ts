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
			rootUrl: 'http://localhost:8207/'
		},
		production: false,
		local: true,
		apiUrl: '/api'
	},
	{
		patterns: ['-d.apps.openshift'],
		banner: {
			text: 'DEV'
		},
		pamsConfig: {
			environment: ObEPamsEnvironment.REF,
			rootUrl: '/pams/'
		},
		production: false,
		local: false,
		apiUrl: '/api'
	},
	{
		patterns: ['-r.apps.openshift'],
		banner: {
			text: 'REF'
		},
		pamsConfig: {
			environment: ObEPamsEnvironment.REF,
			rootUrl: '/pams/'
		},
		production: false,
		local: false,
		apiUrl: '/api'
	},
	{
		patterns: ['-a.apps.openshift'],
		banner: {
			text: 'AQ'
		},
		pamsConfig: {
			environment: ObEPamsEnvironment.ABN,
			rootUrl: '/pams/'
		},
		production: false,
		local: false,
		apiUrl: '/api'
	}
];
