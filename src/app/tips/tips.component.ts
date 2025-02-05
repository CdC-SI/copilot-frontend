import { Component } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

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
      tipsKeys: [
        'tips.sections.retrieval.tips.0',
        'tips.sections.retrieval.tips.1',
        'tips.sections.retrieval.tips.2'
      ]
    },
    {
      titleKey: 'tips.sections.document_management.title',
      tipsKeys: [
        'tips.sections.document_management.tips.0',
        'tips.sections.document_management.tips.1',
        'tips.sections.document_management.tips.2',
        'tips.sections.document_management.tips.3'
      ]
    },
    {
      titleKey: 'tips.sections.advanced_options.title',
      tipsKeys: [
        'tips.sections.advanced_options.tips.0',
        'tips.sections.advanced_options.tips.1',
        'tips.sections.advanced_options.tips.2',
        'tips.sections.advanced_options.tips.3'
      ]
    }
  ];

  constructor(private translate: TranslateService) {}
}
