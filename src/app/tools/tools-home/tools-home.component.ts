import {Component, OnInit} from '@angular/core';
import {ActivatedRoute} from '@angular/router';

export enum ToolsComponentType {
	DocumentAnalysis = 'document-analysis',
	IdentityCheck = 'identity-check'
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

	constructor(private readonly route: ActivatedRoute) {}

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
}
