import {ChangeDetectionStrategy, Component, Input, OnDestroy, OnInit} from '@angular/core';
import {FaqItemFields, IFaqItem} from '../../model/faq';
import {ControlValueAccessor, FormBuilder, FormGroup, NG_VALIDATORS, NG_VALUE_ACCESSOR, ValidationErrors, Validator, Validators} from '@angular/forms';
import {Subject, takeUntil} from 'rxjs';
import {TranslateService} from '@ngx-translate/core';
import {SettingsService} from '../../services/settings.service';
import {SettingsType} from '../../model/settings';
import {SettingsEventService} from '../../services/settings-event.service';
import {AuthenticationServiceV2} from '../../services/auth.service';
import {UserStatus} from '../../model/user';

@Component({
	selector: 'zco-faq-item-edit',
	templateUrl: './faq-item-edit.component.html',
	styleUrl: './faq-item-edit.component.scss',
	providers: [
		{
			provide: NG_VALUE_ACCESSOR,
			useExisting: FaqItemEditComponent,
			multi: true
		},
		{
			provide: NG_VALIDATORS,
			multi: true,
			useExisting: FaqItemEditComponent
		}
	],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class FaqItemEditComponent implements ControlValueAccessor, Validator, OnInit, OnDestroy {
	readonly FORM_FIELDS = FaqItemFields;
	_onTouched: () => void;
	faqItemFrmGrp: FormGroup;
	destroyed$ = new Subject<void | null>();
	languages = ['de', 'fr', 'it', 'en'];
	@Input() editMode: boolean;
	TAGS: string[] = [];

	constructor(
		private readonly fb: FormBuilder,
		private readonly translateService: TranslateService,
		private readonly settingsService: SettingsService,
		private readonly settingsEventService: SettingsEventService,
		private readonly authService: AuthenticationServiceV2
	) {}

	ngOnInit(): void {
		this.faqItemFrmGrp = this.fb.group({
			[FaqItemFields.ID]: [''],
			[FaqItemFields.QUESTION]: ['', Validators.required],
			[FaqItemFields.ANSWER]: ['', Validators.required],
			[FaqItemFields.SOURCE]: ['', Validators.required],
			[FaqItemFields.LANGUAGE]: ['', Validators.required],
			[FaqItemFields.TAGS]: [[]]
		});

		this.loadTags();

		this.authService.$authenticatedUser.pipe(takeUntil(this.destroyed$)).subscribe(user => {
			if (user && user.status === UserStatus.ACTIVE) {
				this.loadTags();
			}
		});

		this.settingsEventService.settingsNeedRefresh.pipe(takeUntil(this.destroyed$)).subscribe(() => {
			this.loadTags();
		});
	}

	ngOnDestroy(): void {
		this.destroyed$.next(null);
		this.destroyed$.complete();
	}

	validate(): ValidationErrors | null {
		return this.faqItemFrmGrp?.valid ? null : {invalid: true};
	}

	writeValue(obj: IFaqItem | null): void {
		if (obj) {
			this.faqItemFrmGrp.patchValue(obj);
		} else {
			this.faqItemFrmGrp.reset();
		}
	}

	registerOnChange(fn: (i: IFaqItem | null) => void): void {
		this.faqItemFrmGrp.valueChanges?.pipe(takeUntil(this.destroyed$)).subscribe(() => fn(this.faqItemFrmGrp.getRawValue()));
	}

	registerOnTouched(fn: any): void {
		this._onTouched = fn;
	}

	setDisabledState(isDisabled: boolean): void {
		if (isDisabled) {
			this.faqItemFrmGrp.disable();
		} else {
			this.faqItemFrmGrp.enable();
		}
	}

	private loadTags(): void {
		this.settingsService.getSettings(SettingsType.TAG).subscribe(tags => {
			this.TAGS = this.sortByTranslation(
				tags.filter(tag => tag && tag !== ''),
				'tags'
			);
		});
	}

	private sortByTranslation(items: string[], prefix: string): string[] {
		return items.sort((a, b) => {
			const translationA = this.translateService.instant(`${prefix}.${a}`);
			const translationB = this.translateService.instant(`${prefix}.${b}`);
			return translationA.localeCompare(translationB);
		});
	}
}
