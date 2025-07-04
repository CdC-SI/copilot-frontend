import {Injectable} from '@angular/core';
import {HttpEvent, HttpHandler, HttpInterceptor, HttpRequest, HttpResponse} from '@angular/common/http';
import {Observable, tap} from 'rxjs';
import {TokenService} from '../services/token.service';
import {nanoid} from 'nanoid';

@Injectable({providedIn: 'root'})
export class AuthenticationInterceptor implements HttpInterceptor {
	constructor(private readonly tokenService: TokenService) {}

	intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
		const headers = this.tokenService.addTokenAsHeader(req.headers);
		return next
			.handle(
				req.clone({
					headers: headers.set('X-Correlation-Id', `${nanoid()}`)
				})
			)
			.pipe(
				tap(resp => {
					if (resp instanceof HttpResponse) {
						this.tokenService.updateTokens(resp.headers);
					}
				})
			);
	}
}
