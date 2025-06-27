import {ChangeDetectionStrategy, Component, EventEmitter, Input, Output} from '@angular/core';
import {FormGroup} from '@angular/forms';
import {FormDef} from '../../model/form-definition';

@Component({
	selector: 'zco-dynamic-form',
	templateUrl: './dynamic-form.component.html',
	styleUrl: './dynamic-form.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
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
