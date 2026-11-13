import {Injectable} from '@angular/core';
import {HttpEvent, HttpHandler, HttpInterceptor, HttpRequest, HttpResponse} from '@angular/common/http';
import {Observable, tap} from 'rxjs';
import {GatewayAuthService} from '../services/gateway-auth.service';

@Injectable({providedIn: 'root'})
export class BlueGatewayInterceptorV2 implements HttpInterceptor {
	constructor(private readonly gatewayAuth: GatewayAuthService) {}

	intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
		request = request.clone({setHeaders: this.gatewayAuth.requestHeaders()});

		return this.gatewayAuth.isLocalhost()
			? next.handle(request)
			: next.handle(request).pipe(
					tap(evt => {
						this.gatewayAuth.checkSession();
						if (evt instanceof HttpResponse) {
							this.gatewayAuth.refreshToken(evt.headers);
						}
					})
				);
	}
}
