import {Component, OnInit} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {AuthenticationServiceV2} from '../../shared/services/auth.service';

export enum ToolsComponentType {
	DocumentAnalysis = 'document-analysis',
	IdentityCheck = 'identity-check',
	Sumex = 'sumex'
}

@Component({
	selector: 'zco-tools-home',
	templateUrl: './tools-home.component.html',
	standalone: false,
	styleUrl: './tools-home.component.scss'
})
export class ToolsHomeComponent implements OnInit {
	TOOLS_COMPONENT_TYPE = ToolsComponentType;
	selectedComponent: ToolsComponentType | null = null;

	constructor(
		private readonly route: ActivatedRoute,
		private readonly authService: AuthenticationServiceV2
	) {}

	ngOnInit() {
		this.route.queryParams.subscribe(params => {
			const menu = params['menu'] as ToolsComponentType;
			this.selectedComponent = Object.values(ToolsComponentType).includes(menu) ? menu : null;
		});
	}

	selectComponent(comp: ToolsComponentType) {
		this.selectedComponent = comp;
	}

	closeComponent() {
		this.selectedComponent = null;
	}

	hasTranslatorRole() {
		return this.authService.hasTranslatorRole();
	}

	hasAdminRole() {
		return this.authService.hasAdminRole();
	}
}
