import {ChangeDetectionStrategy, Component, Input, OnDestroy, OnInit, inject} from '@angular/core';
import {FaqItemFields, IFaqItem} from '../../model/faq';
import {
	ControlValueAccessor,
	FormBuilder,
	FormGroup,
	FormsModule,
	NG_VALIDATORS,
	NG_VALUE_ACCESSOR,
	ReactiveFormsModule,
	ValidationErrors,
	Validator,
	Validators
} from '@angular/forms';
import {Subject, takeUntil} from 'rxjs';
import {TranslatePipe, TranslateService} from '@ngx-translate/core';
import {SettingsService} from '../../services/settings.service';
import {SettingsType} from '../../model/settings';
import {SettingsEventService} from '../../services/settings-event.service';
import {AuthenticationServiceV2} from '../../services/auth.service';
import {UserStatus} from '../../model/user';
import {MatError, MatFormField, MatLabel} from '@angular/material/form-field';
import {ObErrorMessagesDirective, ObMatErrorDirective} from '@oblique/oblique';
import {MatInput} from '@angular/material/input';
import {MatSelect} from '@angular/material/select';
import {MatOption} from '@angular/material/core';

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
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		FormsModule,
		ReactiveFormsModule,
		MatFormField,
		ObErrorMessagesDirective,
		MatLabel,
		MatInput,
		ObMatErrorDirective,
		MatError,
		MatSelect,
		MatOption,
		TranslatePipe
	]
})
export class FaqItemEditComponent implements ControlValueAccessor, Validator, OnInit, OnDestroy {
	readonly FORM_FIELDS = FaqItemFields;
	_onTouched: () => void;
	faqItemFrmGrp: FormGroup;
	destroyed$ = new Subject<void | null>();
	languages = ['de', 'fr', 'it', 'en'];
	@Input() editMode: boolean;
	TAGS: string[] = [];
	private readonly fb = inject(FormBuilder);
	private readonly translateService = inject(TranslateService);
	private readonly settingsService = inject(SettingsService);
	private readonly settingsEventService = inject(SettingsEventService);
	private readonly authService = inject(AuthenticationServiceV2);

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
			if (user?.status === UserStatus.ACTIVE) {
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

	registerOnTouched(fn: () => void): void {
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
