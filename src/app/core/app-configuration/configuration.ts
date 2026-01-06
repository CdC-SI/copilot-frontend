import {ObIBanner, ObIPamsConfiguration} from '@oblique/oblique/lib/utilities.model';
import {ObEPamsEnvironment} from '@oblique/oblique';
import {InjectionToken} from '@angular/core';

export interface Configuration {
	production: boolean;
	local: boolean;
	banner: ObIBanner;
	patterns: string[];
	apiUrl?: string;
}

export const ZCO_CONFIGURATIONS_TOKEN = new InjectionToken('zco-configuration');

export const ZCO_CONFIGURATIONS: Configuration[] = [
	{
		patterns: ['localhost'],
		banner: {
			text: 'local'
		},
		production: false,
		local: true,
		apiUrl: '/copilot/api'
	},
	{
		patterns: ['-d.apps.openshift'],
		banner: {
			text: 'DEV'
		},
		production: false,
		local: false,
		apiUrl: '/copilot/api'
	},
	{
		patterns: ['-r.zas.admin.ch'],
		banner: {
			text: 'REF'
		},
		production: false,
		local: false,
		apiUrl: '/copilot/api'
	},
	{
		patterns: ['-a.zas.admin.ch'],
		banner: {
			text: 'AQ'
		},
		production: false,
		local: false,
		apiUrl: '/copilot/api'
	}
];
