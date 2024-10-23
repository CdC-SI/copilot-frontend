import {Injectable} from '@angular/core';
import {HttpEvent, HttpHandler, HttpInterceptor, HttpRequest} from '@angular/common/http';
import {Observable} from 'rxjs';
import {TokenService} from '../services/token.service';

@Injectable()
export class JwtInterceptor implements HttpInterceptor {
	constructor(private readonly tokenService: TokenService) {}
	intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
		const token = this.tokenService.getToken();
		if (token) {
			req = req.clone({
				setHeaders: {
					Authorization: `Bearer ${token}`
				}
			});
		}

		return next.handle(req);
	}
}
