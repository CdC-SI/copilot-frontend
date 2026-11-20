import {ChangeDetectionStrategy, Component, OnInit, inject} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {AuthenticationServiceV2} from '../../shared/services/auth.service';
import {AlertBannerComponent} from '../../shared/components/alert-banner/alert-banner.component';
import {MatButton} from '@angular/material/button';
import {ObButtonDirective, ObIconButtonDirective} from '@oblique/oblique';
import {MatIcon} from '@angular/material/icon';
import {DocumentAnalysisComponent} from '../document-analysis/document-analysis.component';
import {IdentityCheckComponent} from '../identity-check/identity-check.component';
import {SumexComponent} from '../sumex/sumex.component';
import {CareerSummaryComponent} from '../career-summary/career-summary.component';
import {TranslatePipe} from '@ngx-translate/core';

export enum ToolsComponentType {
	DocumentAnalysis = 'document-analysis',
	IdentityCheck = 'identity-check',
	Sumex = 'sumex',
	CareerSummary = 'career-summary'
}

@Component({
	selector: 'zco-tools-home',
	templateUrl: './tools-home.component.html',
	changeDetection: ChangeDetectionStrategy.Eager,
	styleUrl: './tools-home.component.scss',
	imports: [
		AlertBannerComponent,
		MatButton,
		ObIconButtonDirective,
		ObButtonDirective,
		MatIcon,
		DocumentAnalysisComponent,
		IdentityCheckComponent,
		SumexComponent,
		CareerSummaryComponent,
		TranslatePipe
	]
})
export class ToolsHomeComponent implements OnInit {
	TOOLS_COMPONENT_TYPE = ToolsComponentType;
	selectedComponent: ToolsComponentType | null = null;
	private readonly route = inject(ActivatedRoute);
	private readonly authService = inject(AuthenticationServiceV2);

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
