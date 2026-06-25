import {ObIBanner} from '@oblique/oblique/lib/utilities.model';
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
		apiUrl: '/zia/api'
	},
	{
		patterns: ['-d.zas.admin.ch'],
		banner: {
			text: 'DEV'
		},
		production: false,
		local: false,
		apiUrl: '/zia/api'
	},
	{
		patterns: ['-r.zas.admin.ch'],
		banner: {
			text: 'REF'
		},
		production: false,
		local: false,
		apiUrl: '/zia/api'
	},
	{
		patterns: ['-a.zas.admin.ch'],
		banner: {
			text: 'AQ'
		},
		production: false,
		local: false,
		apiUrl: '/zia/api'
	},
	{
		patterns: ['zia.zas.admin.ch'],
		banner: {
			text: 'PROD'
		},
		production: true,
		local: false,
		apiUrl: '/zia/api'
	}
];
