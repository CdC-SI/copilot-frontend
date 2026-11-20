import {ChangeDetectionStrategy, Component, EventEmitter, Input, Output, TemplateRef, ViewChild, inject, signal} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {SpeechService} from '../../services/speech.service';
import {TranslatePipe, TranslateService} from '@ngx-translate/core';
import {FormControl, FormsModule, ReactiveFormsModule, Validators} from '@angular/forms';
import {IFaqItem} from '../../model/faq';
import {MatDialog, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogTitle} from '@angular/material/dialog';
import {ObButtonDirective, ObIconButtonDirective, ObNotificationService} from '@oblique/oblique';
import {ChatMessage} from '../../model/chat-message';
import {FaqItemsService} from '../../services/faq-items.service';
import {ANSWER_FEEDBACK_CATEGORIES, Feedback, FeedbackCategory} from '../../model/feedback';
import {AuthenticationServiceV2} from '../../services/auth.service';
import {MatIcon} from '@angular/material/icon';
import {MatTooltip} from '@angular/material/tooltip';
import {NgClass} from '@angular/common';
import {CdkScrollable} from '@angular/cdk/scrolling';
import {FaqItemEditComponent} from '../faq-item-edit/faq-item-edit.component';
import {MatButton} from '@angular/material/button';
import {MatRadioButton, MatRadioGroup} from '@angular/material/radio';

@Component({
	selector: 'zco-message-action',
	templateUrl: './message-action.component.html',
	styleUrl: './message-action.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		MatIcon,
		MatTooltip,
		NgClass,
		MatDialogTitle,
		CdkScrollable,
		MatDialogContent,
		FormsModule,
		FaqItemEditComponent,
		ReactiveFormsModule,
		MatDialogActions,
		MatButton,
		MatDialogClose,
		ObIconButtonDirective,
		ObButtonDirective,
		MatRadioGroup,
		MatRadioButton,
		TranslatePipe
	]
})
export class MessageActionComponent {
	@Input() message: ChatMessage;
	@Input() previousMessage: ChatMessage;
	/** Dernière réponse de la conversation : l'action Régénérer est proposée. */
	@Input() regenerable = false;
	@Output() readonly feedback: EventEmitter<Feedback> = new EventEmitter<Feedback>();
	@Output() readonly regenerate = new EventEmitter<void>();

	@ViewChild('addFaqItemDialog') addFaqItemDialog: TemplateRef<any>;
	@ViewChild('feedbackDialog') feedbackDialog: TemplateRef<any>;
	feedBackTitle: string;
	faqItemFrmCtrl = new FormControl<IFaqItem>(null, [Validators.required]);
	feedbackFrmCtrl = new FormControl<string>(null, [Validators.required]);
	categoryFrmCtrl = new FormControl<FeedbackCategory>(null);
	isNegativeFeedback = false;
	readonly answerFeedbackCategories = ANSWER_FEEDBACK_CATEGORIES;
	/** Lecture à voix haute en cours pour ce message. */
	readonly beingSpoken = signal(false);
	private readonly speechService = inject(SpeechService);
	private readonly translateService = inject(TranslateService);
	private readonly dialog = inject(MatDialog);
	private readonly faqItemsService = inject(FaqItemsService);
	private readonly notif = inject(ObNotificationService);
	private readonly authService = inject(AuthenticationServiceV2);

	constructor() {
		// Une autre lecture démarre : celle-ci est interrompue.
		this.speechService.speechStartEvent.pipe(takeUntilDestroyed()).subscribe(() => this.beingSpoken.set(false));
	}

	speak = (): void => {
		speechSynthesis.cancel();
		if (this.beingSpoken()) {
			this.beingSpoken.set(false);
			return;
		}

		this.speechService.speechStartEvent.next(true);
		this.beingSpoken.set(true);
		this.speakMessage(this.message);
	};
	speakMessage = (message: ChatMessage): void => {
		const speech = new SpeechSynthesisUtterance();
		speech.text = message.message;
		speech.rate = 1.5;
		speech.pitch = 1;
		speech.voice = this.speechService.getVoice(message.lang || this.translateService.getCurrentLang());
		speech.onend = () => this.beingSpoken.set(false);
		speechSynthesis.speak(speech);
	};

	openFeedbackDialog(positive: boolean) {
		this.feedbackFrmCtrl.reset();
		this.isNegativeFeedback = !positive;
		this.categoryFrmCtrl.setValue(positive ? null : 'WRONG_ANSWER');
		this.feedBackTitle = positive ? 'feedback.positive' : 'feedback.negative';
		this.dialog
			.open(this.feedbackDialog, {width: '500px'})
			.afterClosed()
			.subscribe(result => result && this.giveFeedback(this.feedbackFrmCtrl.value, positive));
	}

	openFaqItemDialog() {
		this.faqItemFrmCtrl.reset();
		this.faqItemFrmCtrl.patchValue({
			id: this.previousMessage.faqItemId,
			text: this.previousMessage.message,
			answer: this.message.message,
			url: this.message.url,
			language: this.translateService.getCurrentLang()
		});
		this.dialog
			.open(this.addFaqItemDialog, {width: '800px'})
			.afterClosed()
			.subscribe(result => result && this.saveFaqItem(this.faqItemFrmCtrl.value));
	}

	saveFaqItem(faqItem: IFaqItem) {
		this.faqItemsService.add(faqItem).subscribe(next => {
			this.notif.success('edit.item.success');
		});
	}

	authenticatedAsExpert() {
		return this.authService.hasExpertRole();
	}

	copyAnswer(): void {
		if (!navigator.clipboard?.writeText) {
			this.notif.error('i18n.oblique.http.error.general');
			return;
		}
		void navigator.clipboard
			.writeText(this.message.message)
			.then(() => this.notif.success('copilot.answer.copied'))
			.catch(() => this.notif.error('i18n.oblique.http.error.general'));
	}

	private giveFeedback(comment: string, isPositive: boolean) {
		this.feedback.emit({
			messageId: this.message.id,
			question: this.previousMessage.message,
			answer: this.message.message,
			isPositive,
			comment,
			category: isPositive ? undefined : (this.categoryFrmCtrl.value ?? undefined)
		});
	}
}
