import {Component, OnInit} from '@angular/core';
import {ConfirmDialogComponent} from '../../shared/components/confirm-dialog/confirm-dialog.component';
import {FormBuilder, FormGroup} from '@angular/forms';
import {FaqItemsService} from '../../shared/services/faq-items.service';
import {MatDialog} from '@angular/material/dialog';
import {ObNotificationService} from '@oblique/oblique';

@Component({
	selector: 'zco-faq-edit',
	templateUrl: './faq-edit.component.html',
	styleUrl: './faq-edit.component.scss'
})
export class FaqEditComponent implements OnInit {
	addFaqItemFormGrp: FormGroup;

	constructor(
		private readonly fb: FormBuilder,
		private readonly faqItemsService: FaqItemsService,
		private readonly dialog: MatDialog,
		private readonly notifService: ObNotificationService
	) {}

	ngOnInit(): void {
		this.addFaqItemFormGrp = this.fb.group({
			['faqItem']: ['']
		});
	}

	submitFAQItem(): void {
		this.dialog
			.open(ConfirmDialogComponent, {
				width: '400',
				data: {title: 'add.question.answer.ask', content: 'add.question.answer.explanation', type: 'warning'}
			})
			.afterClosed()
			.subscribe((result: boolean) => {
				if (result) {
					this.faqItemsService.add(this.addFaqItemFormGrp.controls['faqItem'].value).subscribe({
						next: () => {
							this.addFaqItemFormGrp.reset();
							this.notifService.success('add.question.answer.success');
						}
					});
				}
			});
	}
}
