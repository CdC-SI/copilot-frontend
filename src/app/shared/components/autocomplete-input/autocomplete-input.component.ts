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

// Add command option type
interface CommandOption {
    text: string;
    isCommand: true;
}

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
export class AutocompleteInputComponent<T extends object> implements OnInit, ControlValueAccessor, OnDestroy, AfterViewInit {
	@Input() i18nLabel: string;
	@Input() required = true;
	@Input() minLength = 0;

	@Input() optionService: (searchText: string) => Observable<any>;
	@Input() inputLabelFn: (value: T) => string;
	@Input() optionLabelFn: (value: T) => string;
	@Input() commands: string[] = [];

	@Output() readonly optionSelected = new EventEmitter<T>();

	@ViewChild('itemFilterInput', {static: true}) itemFilterInput: ElementRef;

	destroyed$ = new Subject<any>();
	formControl: FormControl;
	options: Observable<(T | CommandOption)[]> = of([]);
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
				if (value.startsWith('/')) {
					// Filter commands and add isCommand flag
					this.options = of(this.commands
						.filter(cmd => cmd.toLowerCase().startsWith(value.toLowerCase()))
						.map(cmd => ({ text: cmd, isCommand: true } as CommandOption)));
				} else {
					// Normal autocomplete behavior
					this.options = this.formControl.value?.length > this.minLength ?
						this.optionService(this.formControl.value) :
						of([]);
				}
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

	// Update the option label getter to handle both types
	getOptionLabel(option: T | CommandOption): string {
		if ('isCommand' in option) {
			return option.text;
		}
		const optionLbl = this.optionLabelFn(option as T);
		return this.highlightTextPipe.transform(optionLbl, this.formControl.value);
	}

	// Update fire option selected to handle both types
	fireOptionSelected(value: T | CommandOption): void {
		if ('isCommand' in value) {
			// For commands: set the input value and keep focus
			this.itemFilterInput.nativeElement.value = value.text;
			this._onChange(value.text);
			this.itemFilterInput.nativeElement.focus();
		} else {
			// For FAQ: clear the input and emit the selection
			this.itemFilterInput.nativeElement.value = '';
			this.optionSelected.emit(value as T);
			this._onChange('');
		}
		this.options = of([]);
		this.selected = !!value;
	}

	buildForm() {
		this.formControl = new FormControl('', this.required ? Validators.required : null);
	}

	getProposalLabelFn(): (value: T | CommandOption) => string {
		return value => {
			if ('isCommand' in value) {
				return value.text;
			}
			return this.optionLabelFn(value as T) || '';
		};
	}
}
