import {Component, OnInit} from '@angular/core';
import {FormBuilder, FormGroup, Validators} from '@angular/forms';
import {UserFormFields} from '../../model/user';
import {MatDialogRef} from '@angular/material/dialog';
import {SettingsService} from '../../services/settings.service';
import {SettingsType} from '../../model/settings';
import {UserService} from '../../services/user.service';

@Component({
	selector: 'zco-sign-up',
	templateUrl: './sign-up.component.html',
	styleUrl: './sign-up.component.scss'
})
export class SignUpComponent implements OnInit {
	FORM_FIELDS = UserFormFields;
	ORGANIZATION: string[] = [];
	userFrmGrp: FormGroup;

	constructor(
		private readonly fb: FormBuilder,
		private readonly settingsService: SettingsService,
		private readonly userService: UserService,
		public dialogRef: MatDialogRef<SignUpComponent>
	) {}

	ngOnInit() {
		this.buildForm();
		this.loadOrganizations();
	}

	loadOrganizations() {
		this.settingsService.getSettings(SettingsType.ORGANIZATION).subscribe(organization => {
			this.ORGANIZATION = organization;
		});
	}

	buildForm() {
		this.userFrmGrp = this.fb.group({
			[UserFormFields.FIRSTNAME]: [this.userService.$authenticatedUser.getValue()?.firstName, Validators.required],
			[UserFormFields.LASTNAME]: [this.userService.$authenticatedUser.getValue()?.lastName, Validators.required],
			[UserFormFields.ORGANIZATION]: [[], Validators.required],
			[UserFormFields.CONFIDENTIALITY]: [false, Validators.requiredTrue],
			[UserFormFields.GCU]: [false, Validators.requiredTrue]
		});
	}

	onConfirmClick(): void {
		const formValue = this.userFrmGrp.getRawValue();
		const requestBody = {
			firstName: formValue[UserFormFields.FIRSTNAME],
			lastName: formValue[UserFormFields.LASTNAME],
			organizations: Array.isArray(formValue[UserFormFields.ORGANIZATION]) ? formValue[UserFormFields.ORGANIZATION] : [formValue[UserFormFields.ORGANIZATION]]
		};
		this.dialogRef.close(requestBody);
	}
}
