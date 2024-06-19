import {ObIBanner, ObIPamsConfiguration} from '@oblique/oblique/lib/utilities.model';
import {ObEPamsEnvironment} from '@oblique/oblique';
import {InjectionToken} from '@angular/core';

export interface Configuration {
	production: boolean;
	banner: ObIBanner;
	patterns: string[];
	pamsConfig?: ObIPamsConfiguration;
	apiUrl?:string;
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
		apiUrl: 'http://localhost:8000'
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
		production: false
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
		production: false
	}
];
