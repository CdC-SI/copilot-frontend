import {ChangeDetectionStrategy, Component, OnDestroy, OnInit} from '@angular/core';
import {ControlValueAccessor, FormBuilder, FormGroup, NG_VALIDATORS, NG_VALUE_ACCESSOR, ValidationErrors, Validator} from '@angular/forms';
import {Subject, takeUntil} from 'rxjs';
import {CHAT_REQUEST_FORM_OPTIONS, ChatRequestConfigFields} from '../../model/rag';
import {TranslateService} from '@ngx-translate/core';

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
	CHAT_REQUEST_FORM_OPTIONS = CHAT_REQUEST_FORM_OPTIONS;
	FORM_FIELDS = ChatRequestConfigFields;
	formGroup: FormGroup;
	destroyed$ = new Subject<void>();
	onChange = (value: any) => {};
	onTouched = () => {};

	constructor(
		private readonly fb: FormBuilder,
		private readonly translateService: TranslateService
	) {}

	ngOnInit(): void {
		this.formGroup = this.fb.group({
			[this.FORM_FIELDS.LLM_MODEL]: [''],
			[this.FORM_FIELDS.TAG]: [[]],
			[this.FORM_FIELDS.AUTOCOMPLETE]: [true],
			[this.FORM_FIELDS.RAG]: [true],
			[this.FORM_FIELDS.LANGUAGE]: [this.translateService.currentLang],
			[this.FORM_FIELDS.RESPONSE_STYLE]: [''],
			[this.FORM_FIELDS.CONVERSATION_UUID]: [''],
			[this.FORM_FIELDS.USER_UUID]: [''],
			[this.FORM_FIELDS.K_MEMORY]: [''],
			[this.FORM_FIELDS.RETRIEVAL_METHOD]: [''],
			[this.FORM_FIELDS.SOURCE]: ['']
		});

		this.formGroup.valueChanges.pipe(takeUntil(this.destroyed$)).subscribe(value => {
			this.onChange(value);
			this.onTouched();
		});
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
