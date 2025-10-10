import {Component} from '@angular/core';

interface TipSection {
	titleKey: string;
	tipsKeys: string[];
}

@Component({
	selector: 'zco-tips',
	templateUrl: './tips.component.html',
	styleUrls: ['./tips.component.scss']
})
export class TipsComponent {
	tipSections: TipSection[] = [
		{
			titleKey: 'tips.sections.getting_started.title',
			tipsKeys: [
				'tips.sections.getting_started.tips.0',
				'tips.sections.getting_started.tips.1',
				'tips.sections.getting_started.tips.2',
				'tips.sections.getting_started.tips.3'
			]
		},
		{
			titleKey: 'tips.sections.retrieval.title',
			tipsKeys: ['tips.sections.retrieval.tips.0', 'tips.sections.retrieval.tips.1', 'tips.sections.retrieval.tips.2']
		},
		{
			titleKey: 'tips.sections.document_management.title',
			tipsKeys: [
				'tips.sections.document_management.tips.0',
				'tips.sections.document_management.tips.1',
				'tips.sections.document_management.tips.2',
				'tips.sections.document_management.tips.3'
			]
		}
	];
}
