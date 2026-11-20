import {ChangeDetectionStrategy, Component, EventEmitter, Input, Output} from '@angular/core';
import {FormGroup, FormsModule, ReactiveFormsModule} from '@angular/forms';
import {FormDef} from '../../model/form-definition';
import {NgClass} from '@angular/common';
import {MatButton, MatIconButton} from '@angular/material/button';
import {MatIcon} from '@angular/material/icon';
import {MatAccordion, MatExpansionPanel, MatExpansionPanelHeader, MatExpansionPanelTitle} from '@angular/material/expansion';
import {MatError, MatFormField, MatLabel, MatSuffix} from '@angular/material/form-field';
import {MatInput} from '@angular/material/input';
import {MatDatepicker, MatDatepickerInput, MatDatepickerToggle} from '@angular/material/datepicker';
import {ObMatErrorDirective} from '@oblique/oblique';
import {MatSelect} from '@angular/material/select';
import {MatOption} from '@angular/material/core';

@Component({
	selector: 'zco-dynamic-form',
	templateUrl: './dynamic-form.component.html',
	styleUrl: './dynamic-form.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		FormsModule,
		NgClass,
		ReactiveFormsModule,
		MatIconButton,
		MatIcon,
		MatAccordion,
		MatExpansionPanel,
		MatExpansionPanelHeader,
		MatExpansionPanelTitle,
		MatFormField,
		MatLabel,
		MatInput,
		MatDatepickerInput,
		MatDatepickerToggle,
		MatSuffix,
		MatDatepicker,
		ObMatErrorDirective,
		MatError,
		MatSelect,
		MatOption,
		MatButton
	]
})
export class DynamicFormComponent {
	@Input() def!: FormDef;
	@Input() form!: FormGroup;
	@Output() readonly submitted = new EventEmitter<void>();
	@Output() readonly closeForm = new EventEmitter<void>();

	submit() {
		if (this.form.valid) this.submitted.emit();
		else this.form.markAllAsTouched();
	}

	onEscape() {
		this.closeForm.emit();
	}
}
