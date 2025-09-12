import {Component, OnInit} from '@angular/core';
import {IdentityCheckService} from '../../shared/services/identity-check.service';
import {AuthenticationServiceV2} from '../../shared/services/auth.service';

@Component({
	selector: 'zco-identity-check',
	templateUrl: './identity-check.component.html',
	styleUrls: ['./identity-check.component.scss'],
	standalone: false
})
export class IdentityCheckComponent implements OnInit {
	identityCheckStatus: any;

	constructor(
		private readonly authenticateService: IdentityCheckService,
		private readonly authService: AuthenticationServiceV2
	) {}

	ngOnInit(): void {
		this.authService.$authenticatedUser.subscribe(user => {
			this.authenticateService.getIdentityCheckStatus().subscribe(response => {
				this.identityCheckStatus = response;
			});
		});
	}

	onSubmit(): void {
		this.authenticateService.startIdentyCheck().subscribe(response => {
			window.open(response.endpoint, '_blank');
		});
	}
}
