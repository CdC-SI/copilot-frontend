import {Component, OnInit} from '@angular/core';
import {AbstractControl, FormBuilder, FormGroup, ValidationErrors, Validators} from '@angular/forms';
import {UserFormFields} from '../../model/user';
import {MatDialogRef} from '@angular/material/dialog';

@Component({
	selector: 'zco-sign-up',
	templateUrl: './sign-up.component.html',
	styleUrl: './sign-up.component.scss'
})
export class SignUpComponent implements OnInit {
	FORM_FIELDS = UserFormFields;
	userFrmGrp: FormGroup;

	constructor(
		private readonly fb: FormBuilder,
		public dialogRef: MatDialogRef<SignUpComponent>
	) {}

	ngOnInit() {
		this.buildForm();
	}

	buildForm() {
		this.userFrmGrp = this.fb.group(
			{
				[UserFormFields.PASSWORD]: ['', Validators.required],
				[UserFormFields.USERNAME]: ['', Validators.required],
				[UserFormFields.CONFIRM_PASSWORD]: ['', Validators.required]
			},
			{validators: this.customPasswordMatching.bind(this)}
		);
	}

	public customPasswordMatching(control: AbstractControl): ValidationErrors | null {
		const password = control.get(UserFormFields.PASSWORD)?.value;
		const confirmPassword = control.get(UserFormFields.CONFIRM_PASSWORD)?.value;
		return password === confirmPassword ? null : {passwordMismatchError: true};
	}

	onCancelClick(): void {
		this.dialogRef.close('');
	}

	onConfirmClick(): void {
		this.dialogRef.close(this.userFrmGrp.getRawValue());
	}
}
