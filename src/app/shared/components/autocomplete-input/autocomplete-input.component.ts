import {
	AfterViewInit,
	ChangeDetectionStrategy,
	ChangeDetectorRef,
	Component,
	ElementRef,
	EventEmitter,
	Input,
	OnDestroy,
	OnInit,
	Output,
	ViewChild
} from '@angular/core';
import {Observable, Subject, debounceTime, fromEvent, map, of} from 'rxjs';
import {ControlValueAccessor, FormControl, NG_VALUE_ACCESSOR, Validators} from '@angular/forms';
import {HighlightTextPipe} from '../../pipes/highlight-text.pipe';

@Component({
	selector: 'ut-autocomplete-input',
	changeDetection: ChangeDetectionStrategy.OnPush,
	templateUrl: './autocomplete-input.component.html',
	styleUrls: ['./autocomplete-input.component.scss'],
	providers: [
		{
			provide: NG_VALUE_ACCESSOR,
			useExisting: AutocompleteInputComponent,
			multi: true
		}
	]
})
export class AutocompleteInputComponent<T> implements OnInit, ControlValueAccessor, OnDestroy, AfterViewInit {
	@Input() i18nLabel: string;
	@Input() required = true;
	@Input() minLength = 0;

	@Input() optionService: (searchText: string) => Observable<T[]>;
	@Input() inputLabelFn: (value: T) => string;
	@Input() optionLabelFn: (value: T) => string;

	@Output() readonly optionSelected = new EventEmitter<T>();
	@Output() readonly inputChange = new EventEmitter<string>();
	@Output() readonly attachmentsSelected = new EventEmitter<File[]>();

	@ViewChild('itemFilterInput', {static: true}) itemFilterInput: ElementRef;

	destroyed$ = new Subject<any>();
	formControl: FormControl;
	options: Observable<T[]> = of([]);
	_onTouched: () => void;
	_onChange: (p: any) => void;
	selected = false;

	constructor(
		private readonly highlightTextPipe: HighlightTextPipe,
		private readonly cdr: ChangeDetectorRef
	) {}

	ngOnInit(): void {
		this.buildForm();
	}

	ngAfterViewInit(): void {
		fromEvent<KeyboardEvent>(this.itemFilterInput.nativeElement, 'keyup')
			.pipe(
				map(event => (event.target as HTMLInputElement).value),
				debounceTime(200)
			)
			.subscribe(value => {
				this.options = this.formControl.value?.length > this.minLength ? this.optionService(this.formControl.value) : of([]);
				this.inputChange.emit(value);
				this.cdr.markForCheck();
				this._onChange(value);
			});
	}

	ngOnDestroy(): void {
		this.destroyed$.next(null);
		this.destroyed$.complete();
	}

	registerOnChange(fn: any): void {
		this._onChange = fn;
	}

	setDisabledState(isDisabled: boolean): void {
		if (isDisabled) {
			this.formControl.disable();
		} else {
			this.formControl.enable();
		}
	}

	registerOnTouched(fn: any): void {
		this._onTouched = fn;
	}

	writeValue(value: string): void {
		this.formControl.setValue(value);
	}

	getOptionLabel(option: any): string {
		const optionLbl = this.optionLabelFn(option);
		return this.highlightTextPipe.transform(optionLbl, this.formControl.value);
	}

	fireOptionSelected(value: any) {
		this.itemFilterInput.nativeElement.value = this.inputLabelFn(value);
		this.options = of([]);
		this.selected = !!value;
		this.optionSelected.emit(value);
		this._onChange(value);
	}

	buildForm() {
		this.formControl = new FormControl('', this.required ? Validators.required : null);
	}

	getProposalLabelFn(): (value: T) => string {
		return value => {
			return this.optionLabelFn(value) || (value as string);
		};
	}

	onFilesChange(event: Event) {
		const input = event.target as HTMLInputElement;
		if (!input.files) return;
		this.attachmentsSelected.emit(Array.from(input.files));
		input.value = '';
	}
}
