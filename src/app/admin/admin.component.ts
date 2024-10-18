import {Component, OnInit} from '@angular/core';
import {FormBuilder, FormGroup} from '@angular/forms';
import {MatDialog} from '@angular/material/dialog';
import {ConfirmDialogComponent} from '../shared/components/confirm-dialog/confirm-dialog.component';
import {ObNotificationService} from '@oblique/oblique';
import { FaqItemsService } from "../shared/services/faq-items.service";

@Component({
	selector: 'zco-admin',
	templateUrl: './admin.component.html',
	styleUrl: './admin.component.scss'
})
export class AdminComponent implements OnInit {
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

	submit(): void {
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
