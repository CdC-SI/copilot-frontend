import {ChangeDetectionStrategy, Component, OnDestroy, OnInit} from '@angular/core';
import {ControlValueAccessor, FormBuilder, FormGroup, NG_VALIDATORS, NG_VALUE_ACCESSOR, ValidationErrors, Validator} from '@angular/forms';
import {Subject, takeUntil} from 'rxjs';
import {ChatRequestConfigFields} from '../../model/rag';
import {TranslateService} from '@ngx-translate/core';
import {SettingsService} from '../../services/settings.service';
import {SettingsType} from '../../model/settings';
import {SettingsEventService} from '../../services/settings-event.service';
import {UserStatus} from '../../model/user';
import {AuthenticationServiceV2} from '../../services/auth.service';
import {MatSelectChange} from '@angular/material/select';

@Component({
	selector: 'zco-chat-configuration-edit',
	templateUrl: './chat-configuration-edit.component.html',
	styleUrl: './chat-configuration-edit.component.scss',
	providers: [
		{
			provide: NG_VALUE_ACCESSOR,
			useExisting: ChatConfigurationEditComponent,
			multi: true
		},
		{
			provide: NG_VALIDATORS,
			useExisting: ChatConfigurationEditComponent,
			multi: true
		}
	],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChatConfigurationEditComponent implements OnInit, OnDestroy, ControlValueAccessor, Validator {
	TAGS: string[] = [];
	SOURCES: string[] = [];
	RESPONSE_STYLE: string[] = [];
	RESPONSE_FORMAT: string[] = [];
	FORM_FIELDS = ChatRequestConfigFields;
	formGroup: FormGroup;
	destroyed$ = new Subject<void>();
	constructor(
		private readonly fb: FormBuilder,
		private readonly translateService: TranslateService,
		private readonly settingsService: SettingsService,
		private readonly authService: AuthenticationServiceV2,
		private readonly settingsEventService: SettingsEventService
	) {}
	onChange = (value: any) => {};

	onTouched = () => {};

	buildForm() {
		this.formGroup = this.fb.group({
			[this.FORM_FIELDS.TAGS]: [[]],
			[this.FORM_FIELDS.LANGUAGE]: [this.translateService.currentLang],
			[this.FORM_FIELDS.RESPONSE_STYLE]: [''],
			[this.FORM_FIELDS.RESPONSE_FORMAT]: [''],
			[this.FORM_FIELDS.SOURCES]: ['']
		});
	}

	ngOnInit(): void {
		this.buildForm();
		this.configureForm();

		this.authService.$authenticatedUser.subscribe(user => {
			if (user && user.status === UserStatus.ACTIVE) {
				this.loadDropdowns();
			}
		});

		this.settingsEventService.settingsNeedRefresh.pipe(takeUntil(this.destroyed$)).subscribe(() => {
			this.loadDropdowns();
		});
	}

	configureForm() {
		this.formGroup.valueChanges.pipe(takeUntil(this.destroyed$)).subscribe(value => {
			this.onChange(value);
			this.onTouched();
		});
	}

	loadDropdowns() {
		this.getTags();
		this.settingsService.getSettings(SettingsType.SOURCE).subscribe(sources => {
			this.SOURCES = this.sortByTranslation(
				sources.filter(source => source && source !== ''),
				'sources'
			);
		});
		this.settingsService.getSettings(SettingsType.RESPONSE_STYLE).subscribe(styles => {
			this.RESPONSE_STYLE = styles;
		});
		this.settingsService.getSettings(SettingsType.RESPONSE_FORMAT).subscribe(formats => {
			this.RESPONSE_FORMAT = formats;
		});
	}

	isUserPdfUpload(source: string): boolean {
		return source.startsWith('user_pdf_upload:');
	}

	getUserPdfFilename(source: string): string {
		return source.split(':')[1] || '';
	}

	ngOnDestroy(): void {
		this.destroyed$.next();
		this.destroyed$.complete();
	}

	writeValue(value: any): void {
		if (value) {
			this.formGroup.setValue(value, {emitEvent: false});
		} else {
			this.formGroup.reset();
		}
	}

	registerOnChange(fn: any): void {
		this.onChange = fn;
	}

	registerOnTouched(fn: any): void {
		this.onTouched = fn;
	}

	setDisabledState?(isDisabled: boolean): void {
		if (isDisabled) {
			this.formGroup.disable();
		} else {
			this.formGroup.enable();
		}
	}

	validate(): ValidationErrors | null {
		return this.formGroup.valid ? null : {invalidForm: {valid: false}};
	}

	filterTags(event: MatSelectChange) {
		const filterValue = event.value.join(',');
		if (!filterValue) {
			this.getTags();
		} else {
			this.getFilteredTags(filterValue);
		}
	}

	private getTags() {
		this.settingsService.getSettings(SettingsType.TAG).subscribe(tags => {
			this.TAGS = this.sortByTranslation(
				tags.filter(tag => tag && tag !== ''),
				'tags'
			);
		});
	}

	private getFilteredTags(filterValue: string) {
		this.settingsService.getFilteredTags(filterValue).subscribe(tags => {
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
