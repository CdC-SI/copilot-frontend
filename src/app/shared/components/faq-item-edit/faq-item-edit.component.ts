import {ChangeDetectionStrategy, Component, Input, OnDestroy, OnInit} from '@angular/core';
import {FaqItemFields, IFaqItem} from '../../model/faq';
import {ControlValueAccessor, FormBuilder, FormGroup, NG_VALIDATORS, NG_VALUE_ACCESSOR, ValidationErrors, Validator, Validators} from '@angular/forms';
import {Subject, takeUntil} from 'rxjs';

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

	constructor(private readonly fb: FormBuilder) {}

	ngOnInit(): void {
		this.faqItemFrmGrp = this.fb.group({
			[FaqItemFields.ID]: [''],
			[FaqItemFields.QUESTION]: ['', Validators.required],
			[FaqItemFields.ANSWER]: ['', Validators.required],
			[FaqItemFields.SOURCE]: ['', Validators.required],
			[FaqItemFields.LANGUAGE]: ['', Validators.required]
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
}
