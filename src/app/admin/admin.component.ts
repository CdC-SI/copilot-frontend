import {Component, OnInit} from '@angular/core';
import {FormBuilder, FormGroup} from '@angular/forms';
import {IFaqItem} from '../shared/model/faq';
import {AdminService} from '../shared/services/admin.service';
import {Router} from '@angular/router';
import {MatDialog} from '@angular/material/dialog';
import {ConfirmDialogComponent} from '../shared/components/confirm-dialog/confirm-dialog.component';

@Component({
	selector: 'zco-admin',
	templateUrl: './admin.component.html',
	styleUrl: './admin.component.scss'
})
export class AdminComponent implements OnInit {
	addFaqItemFormGrp: FormGroup;
	faqItem: IFaqItem;

	constructor(
		private readonly fb: FormBuilder,
		private readonly adminService: AdminService,
		private readonly router: Router,
		private readonly dialog: MatDialog
	) {}

	ngOnInit(): void {
		speechSynthesis.cancel();
		this.addFaqItemFormGrp = this.fb.group({
			['faqItem']: ['']
		});

		const llmAnswerToInsert = this.adminService.getLlmAnswerToInsert();
		if (llmAnswerToInsert) {
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
					title: 'admin.add.item',
					content: 'admin.add.item.confirm',
					type: 'warning'
				}
			})
			.afterClosed()
			.subscribe((result: boolean) => {
				if (result) {
					this.adminService.addFaqItem(this.faqItem).subscribe(() => {
						this.adminService.setLlmAnswerToInsert(null);
						this.addFaqItemFormGrp.reset();
					});
				}
			});
	}
}
