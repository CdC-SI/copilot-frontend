import {ChangeDetectionStrategy, Component, OnInit, inject} from '@angular/core';
import {ConfirmDialogComponent} from '../../shared/components/confirm-dialog/confirm-dialog.component';
import {FormBuilder, FormGroup, FormsModule, ReactiveFormsModule} from '@angular/forms';
import {FaqItemsService} from '../../shared/services/faq-items.service';
import {MatDialog} from '@angular/material/dialog';
import {ObButtonDirective, ObIconButtonDirective, ObNotificationService} from '@oblique/oblique';
import {MatCard, MatCardActions, MatCardContent} from '@angular/material/card';
import {FaqItemEditComponent} from '../../shared/components/faq-item-edit/faq-item-edit.component';
import {MatButton} from '@angular/material/button';
import {MatIcon} from '@angular/material/icon';
import {TranslatePipe} from '@ngx-translate/core';

@Component({
	selector: 'zco-faq-edit',
	templateUrl: './faq-edit.component.html',
	styleUrl: './faq-edit.component.scss',
	changeDetection: ChangeDetectionStrategy.Eager,
	imports: [
		FormsModule,
		ReactiveFormsModule,
		MatCard,
		MatCardContent,
		FaqItemEditComponent,
		MatCardActions,
		MatButton,
		ObIconButtonDirective,
		ObButtonDirective,
		MatIcon,
		TranslatePipe
	]
})
export class FaqEditComponent implements OnInit {
	addFaqItemFormGrp: FormGroup;
	private readonly fb = inject(FormBuilder);
	private readonly faqItemsService = inject(FaqItemsService);
	private readonly dialog = inject(MatDialog);
	private readonly notifService = inject(ObNotificationService);

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
