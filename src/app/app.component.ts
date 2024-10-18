import {Component} from '@angular/core';
import {MatDialog} from '@angular/material/dialog';
import {SignUpComponent} from './shared/components/sign-up/sign-up.component';
import {UserService} from './shared/services/user.service';
import {ObNotificationService} from '@oblique/oblique';
import {IUser} from './shared/model/user';

@Component({
	selector: 'zco-root',
	templateUrl: './app.component.html',
	styleUrl: './app.component.css'
})
export class AppComponent {
	constructor(
		private readonly dialog: MatDialog,
		private readonly userService: UserService,
		private readonly notif: ObNotificationService
	) {}

	openSignUpDialog() {
		this.dialog
			.open(SignUpComponent, {width: '800px'})
			.afterClosed()
			.subscribe(result => result && this.createUser(result));
	}

	createUser(user: IUser) {
		this.userService.createAccount(user).subscribe((userId: string) => {
			this.notif.success('Account created successfully');
		});
	}
}
