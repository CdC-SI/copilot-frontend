import {Component, OnInit} from '@angular/core';
import {FormBuilder, FormGroup, Validators} from '@angular/forms';
import {MatDialogRef} from '@angular/material/dialog';
import {IUser, LoginFormFields} from '../../model/user';
import {UserService} from '../../services/user.service';
import {IToken} from '../../model/token';

@Component({
	selector: 'zco-sign-in',
	templateUrl: './sign-in.component.html',
	styleUrl: './sign-in.component.scss'
})
export class SignInComponent implements OnInit {
	FORM_FIELDS = LoginFormFields;
	loginFrmGrp: FormGroup;
	wrongCredentials = false;

	constructor(
		private readonly fb: FormBuilder,
		public dialogRef: MatDialogRef<SignInComponent>,
		private readonly userService: UserService
	) {}
	ngOnInit() {
		this.buildForm();
	}
	buildForm() {
		this.loginFrmGrp = this.fb.group({
			[LoginFormFields.PASSWORD]: ['', Validators.required],
			[LoginFormFields.USERNAME]: ['', Validators.required]
		});
	}
	onConfirmClick(): void {
		this.wrongCredentials = false;
		this.userService.login(this.loginFrmGrp.getRawValue()).subscribe({
			next: (token: IToken) => {
				this.dialogRef.close(token);
			},
			error: error => {
				this.wrongCredentials = true;
				this.loginFrmGrp.reset();
			}
		});
	}
}
