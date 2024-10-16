import {Component, Input, TemplateRef, ViewChild} from '@angular/core';
import {ChatMessage} from '../../services/chat-message';
import {SpeechService} from '../../services/speech.service';
import {TranslateService} from '@ngx-translate/core';
import {FormControl, Validators} from '@angular/forms';
import {IFaqItem} from '../../model/faq';
import {MatDialog} from '@angular/material/dialog';
import {AdminService} from '../../services/admin.service';
import {ObNotificationService} from '@oblique/oblique';

@Component({
	selector: 'zco-message-action',
	templateUrl: './message-action.component.html',
	styleUrl: './message-action.component.scss'
})
export class MessageActionComponent {
	@Input() message: ChatMessage;
	@Input() previousMessage: ChatMessage;

	@ViewChild('addFaqItemDialog') addFaqItemDialog: TemplateRef<any>;
	faqItemFrmCtrl = new FormControl<IFaqItem>(null, [Validators.required]);

	constructor(
		private readonly speechService: SpeechService,
		private readonly translateService: TranslateService,
		private readonly dialog: MatDialog,
		private readonly adminService: AdminService,
		private readonly notif: ObNotificationService
	) {}

	speak = (): void => {
		speechSynthesis.cancel();
		this.message.beingSpoken = !this.message.beingSpoken;
		if (this.message.beingSpoken) {
			this.speakMessage(this.message);
		}
	};

	speakMessage = (message: ChatMessage): void => {
		const speech = new SpeechSynthesisUtterance();
		speech.text = message.message;
		speech.rate = 1.5;
		speech.pitch = 1;
		speech.voice = this.speechService.getVoice(message.lang || this.translateService.currentLang);
		speechSynthesis.speak(speech);
	};

	openFaqItemDialog() {
		this.faqItemFrmCtrl.reset();
		this.faqItemFrmCtrl.patchValue({
			id: this.previousMessage.faqItemId,
			text: this.previousMessage.message,
			answer: this.message.message,
			url: this.message.url,
			language: this.translateService.currentLang
		});
		this.dialog
			.open(this.addFaqItemDialog, {width: '800px'})
			.afterClosed()
			.subscribe(result => result && this.saveFaqItem(this.faqItemFrmCtrl.value));
	}

	saveFaqItem(faqItem: IFaqItem) {
		this.adminService.addFaqItem(faqItem).subscribe(next => {
			this.notif.success('edit.item.success');
		});
	}
}
