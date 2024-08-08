import {Component, OnInit} from '@angular/core';
import {FormBuilder, FormGroup} from '@angular/forms';
import {IFaqItem} from '../shared/model/faq';
import {AdminService} from '../shared/services/admin.service';
import {Router} from '@angular/router';
import {MatDialog} from '@angular/material/dialog';
import {ConfirmDialogComponent} from '../shared/components/confirm-dialog/confirm-dialog.component';
import {ObNotificationService} from '@oblique/oblique';

@Component({
	selector: 'zco-admin',
	templateUrl: './admin.component.html',
	styleUrl: './admin.component.scss'
})
export class AdminComponent implements OnInit {
	addFaqItemFormGrp: FormGroup;
	faqItem: IFaqItem;
	faqEditMode = false;

	constructor(
		private readonly fb: FormBuilder,
		private readonly adminService: AdminService,
		private readonly router: Router,
		private readonly dialog: MatDialog,
		private readonly notifService: ObNotificationService
	) {}

	ngOnInit(): void {
		speechSynthesis.cancel();
		this.addFaqItemFormGrp = this.fb.group({
			['faqItem']: ['']
		});

		const llmAnswerToInsert = this.adminService.getLlmAnswerToInsert();
		if (llmAnswerToInsert) {
			if (llmAnswerToInsert.id) this.faqEditMode = true;
			this.addFaqItemFormGrp.patchValue({faqItem: llmAnswerToInsert});
		}
	}

	cancel(): void {
		this.adminService.setLlmAnswerToInsert(null);
		this.addFaqItemFormGrp.reset();
		void this.router.navigateByUrl('/');
	}

	submit(): void {
		this.faqItem = this.addFaqItemFormGrp.getRawValue().faqItem;
		this.dialog
			.open(ConfirmDialogComponent, {
				data: {
					title: this.faqEditMode ? 'admin.edit.item' : 'admin.add.item',
					content: this.faqEditMode ? 'admin.edit.item.confirm' : 'admin.add.item.confirm',
					type: 'warning'
				}
			})
			.afterClosed()
			.subscribe((result: boolean) => {
				if (result) {
					this.adminService.addFaqItem(this.faqItem).subscribe({
						next: () => {
							this.adminService.setLlmAnswerToInsert(null);
							this.addFaqItemFormGrp.reset();
							this.notifService.success('admin.add.item.success');
						},
						error: () => {
							this.notifService.error('admin.add.item.error');
						}
					});
				}
			});
	}
}
