import {Injectable, TemplateRef, inject} from '@angular/core';
import {MatDialog, MatDialogRef} from '@angular/material/dialog';
import {AuthenticationServiceV2} from '../../shared/services/auth.service';
import {UserStatus} from '../../shared/model/user';

@Injectable({
	providedIn: 'root'
})
export class UserAuthDialogService {
	private readonly authService = inject(AuthenticationServiceV2);
	private readonly dialog = inject(MatDialog);

	isRegistered(): boolean {
		return this.authService.isRegistered();
	}

	showAuthDialog(userNotRegisteredDialog: TemplateRef<any>, johnDoeDialog: TemplateRef<any>, userPendingDialog: TemplateRef<any>): MatDialogRef<any> | null {
		const userStatus = this.authService.userStatus();

		if (userStatus === UserStatus.GUEST) {
			return this.dialog.open(userNotRegisteredDialog);
		} else if (userStatus === UserStatus.JOHN_DOE) {
			return this.dialog.open(johnDoeDialog);
		} else if (userStatus === UserStatus.PENDING_ACTIVATION) {
			return this.dialog.open(userPendingDialog);
		}

		return null;
	}
}
