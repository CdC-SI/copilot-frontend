import {Component, OnInit} from '@angular/core';
import {FormBuilder, FormGroup, Validators} from '@angular/forms';
import {UserFormFields} from '../../model/user';
import {MatDialogRef} from '@angular/material/dialog';
import {AuthenticationServiceV2} from '../../services/auth.service';

@Component({
	selector: 'zco-sign-up',
	templateUrl: './sign-up.component.html',
	styleUrl: './sign-up.component.scss'
})
export class SignUpComponent implements OnInit {
	FORM_FIELDS = UserFormFields;
	userFrmGrp: FormGroup;
	userIsFromZas: boolean = true;

	constructor(
		private readonly fb: FormBuilder,
		private readonly authService: AuthenticationServiceV2,
		public dialogRef: MatDialogRef<SignUpComponent>
	) {}

	ngOnInit() {
		this.buildForm();
	}

	buildForm() {
		this.userFrmGrp = this.fb.group({
			[UserFormFields.FIRSTNAME]: [this.authService.$authenticatedUser.getValue()?.firstName, Validators.required],
			[UserFormFields.LASTNAME]: [this.authService.$authenticatedUser.getValue()?.lastName, Validators.required],
			[UserFormFields.CONFIDENTIALITY]: [false, Validators.requiredTrue],
			[UserFormFields.GCU]: [false, Validators.requiredTrue]
		});
	}

	onConfirmClick(): void {
		const formValue = this.userFrmGrp.getRawValue();
		const requestBody = {
			firstName: formValue[UserFormFields.FIRSTNAME],
			lastName: formValue[UserFormFields.LASTNAME],
			organizations: this.userIsFromZas ? ['ZAS'] : []
		};
		this.dialogRef.close(requestBody);
	}

	onToggleChange() {
		this.userIsFromZas = !this.userIsFromZas;
	}
}
