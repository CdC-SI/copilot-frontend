import {AfterViewInit, ChangeDetectionStrategy, Component, OnDestroy, OnInit} from '@angular/core';
import {ControlValueAccessor, FormBuilder, FormGroup, NG_VALIDATORS, NG_VALUE_ACCESSOR, ValidationErrors, Validator} from '@angular/forms';
import {Subject, takeUntil} from 'rxjs';
import {ChatRequestConfigFields} from '../../model/rag';
import {TranslateService} from '@ngx-translate/core';
import {SettingsService} from '../../services/settings.service';
import {SettingsType} from '../../model/settings';
import {clearNullAndEmpty} from '../../utils/zco-utils';
import {UserService} from '../../services/user.service';

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
	LLM_MODELS: string[] = [];
	RETRIEVAL_METHODS: string[] = [];
	RESPONSE_STYLE: string[] = [];
	RESPONSE_FORMAT: string[] = [];
	FORM_FIELDS = ChatRequestConfigFields;
	formGroup: FormGroup;
	destroyed$ = new Subject<void>();
	constructor(
		private readonly fb: FormBuilder,
		private readonly translateService: TranslateService,
		private readonly settingsService: SettingsService,
		private readonly userService: UserService
	) {}
	onChange = (value: any) => {};

	onTouched = () => {};

	buildForm() {
		this.formGroup = this.fb.group({
			[this.FORM_FIELDS.LLM_MODEL]: [''],
			[this.FORM_FIELDS.TAGS]: [[]],
			[this.FORM_FIELDS.AUTOCOMPLETE]: [],
			[this.FORM_FIELDS.RAG]: [],
			[this.FORM_FIELDS.AGENTIC_RAG]: [],
			[this.FORM_FIELDS.LANGUAGE]: [this.translateService.currentLang],
			[this.FORM_FIELDS.RESPONSE_STYLE]: [''],
			[this.FORM_FIELDS.RESPONSE_FORMAT]: [''],
			[this.FORM_FIELDS.K_MEMORY]: [''],
			[this.FORM_FIELDS.K_RETRIEVE]: [''],
			[this.FORM_FIELDS.MAX_OUTPUT_TOKENS]: [''],
			[this.FORM_FIELDS.TOP_P]: [''],
			[this.FORM_FIELDS.TEMPERATURE]: [''],
			[this.FORM_FIELDS.RETRIEVAL_METHODS]: [''],
			[this.FORM_FIELDS.SOURCES]: [''],
			[this.FORM_FIELDS.SOURCE_VALIDATION]: [''],
			[this.FORM_FIELDS.TOPIC_CHECK]: ['']
		});

		setTimeout(() => {
			this.formGroup.patchValue({
				[this.FORM_FIELDS.AUTOCOMPLETE]: true,
				[this.FORM_FIELDS.RAG]: true,
				[this.FORM_FIELDS.AGENTIC_RAG]: false,
				[this.FORM_FIELDS.SOURCE_VALIDATION]: true,
				[this.FORM_FIELDS.TOPIC_CHECK]: false
			});
		});
	}

	ngOnInit(): void {
		this.buildForm();
		this.configureForm();
		this.loadDropdowns();

		this.userService.userLoggedIn
			.pipe(takeUntil(this.destroyed$))
			.subscribe(() => {
				this.loadDropdowns();
			});
	}

	configureForm() {
		this.formGroup.valueChanges.pipe(takeUntil(this.destroyed$)).subscribe(value => {
			this.onChange(value);
			this.onTouched();
		});

		// Add mutual exclusivity for RAG toggles
		const ragControl = this.formGroup.get(this.FORM_FIELDS.RAG);
		const agenticRagControl = this.formGroup.get(this.FORM_FIELDS.AGENTIC_RAG);

		ragControl?.valueChanges
			.pipe(takeUntil(this.destroyed$))
			.subscribe(enabled => {
				if (enabled) {
					agenticRagControl?.setValue(false, { emitEvent: false });
				}
			});

		agenticRagControl?.valueChanges
			.pipe(takeUntil(this.destroyed$))
			.subscribe(enabled => {
				if (enabled) {
					ragControl?.setValue(false, { emitEvent: false });
				}
			});
	}

	loadDropdowns() {
		this.settingsService.getSettings(SettingsType.TAG).subscribe(tags => {
			this.TAGS = tags.filter(tag => tag && tag !== '');
		});
		this.settingsService.getSettings(SettingsType.SOURCE).subscribe(sources => {
			this.SOURCES = sources.filter(source => source && source !== '');
		});
		this.settingsService.getSettings(SettingsType.LLM_MODEL).subscribe(llmModels => {
			this.LLM_MODELS = llmModels;
		});
		this.settingsService.getSettings(SettingsType.RETRIEVAL_METHOD).subscribe(retrievalMethods => {
			this.RETRIEVAL_METHODS = retrievalMethods;
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
}
