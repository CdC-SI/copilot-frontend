import {Injectable} from '@angular/core';
import {HttpEvent, HttpHandler, HttpHeaders, HttpInterceptor, HttpRequest, HttpResponse, HttpResponseBase} from '@angular/common/http';
import {Observable, mergeMap, of, tap} from 'rxjs';
import {MatDialog} from '@angular/material/dialog';
import {take} from 'rxjs/operators';
import {nanoid} from 'nanoid';
import {AuthenticationDialogComponent, EnvironmentService, LocalStorageService} from 'zas-design-system';
import {AuthenticationServiceV2} from '../services/auth.service';

@Injectable({providedIn: 'root'})
export class BlueGatewayInterceptorV2 implements HttpInterceptor {
	private readonly GATEWAY_COLOR: string = 'blue';

	constructor(
		private readonly dialog: MatDialog,
		private readonly authenticationService: AuthenticationServiceV2,
		private readonly localStorageService: LocalStorageService,
		private readonly environmentService: EnvironmentService
	) {}

	intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
		request = request.clone({
			setHeaders: {
				'X-Correlation-Id': `${nanoid()}`,
				[this.GATEWAY_COLOR]:
					`Bearer ${this.environmentService.getIsLocalhostEnvironment() ? this.environmentService.getMockToken() : this.authenticationService.jwtToken}`
			}
		});

		return this.environmentService.getIsLocalhostEnvironment()
			? next.handle(request)
			: next.handle(request).pipe(
					mergeMap(value => {
						/**
						 * Check if we are disconnected from other tabs
						 * ACCESS_TOKEN expiration lifetime is also check in gateway backend
						 */
						if (this.authenticationService.jwtToken && !this.localStorageService.isConnected()) {
							this.displayUnauthorize();
						}
						return of(value);
					}),
					/*
					 * we obtain successful http transaction
					 * we get blue header when the token is refreshed, we update our jwt token
					 */
					tap(evt => {
						if (evt instanceof HttpResponse) {
							this.updateToken(evt);
						}
					})
				);
	}

	private updateToken(response: HttpResponseBase) {
		const headers: HttpHeaders = response.headers;
		if (headers.get(this.GATEWAY_COLOR)) {
			this.authenticationService.jwtToken = headers.get(this.GATEWAY_COLOR);
		}
	}

	private displayUnauthorize() {
		const dialogExist = this.dialog.getDialogById('unauthorized');
		/* prevent multiple popUp display */
		if (!dialogExist) {
			this.dialog
				.open(AuthenticationDialogComponent, {
					id: 'unauthorized',
					disableClose: true,
					data: {
						unauthorized: true,
						header: 'i18n.authentication.expired'
					}
				})
				.afterClosed()
				.pipe(take(1));
		}
	}
}
