import {Injectable} from '@angular/core';
import {IToken} from '../model/token';

@Injectable({
	providedIn: 'root'
})
export class TokenService {
	private readonly tokenKey = 'auth_token';
	constructor() {}
	setToken(token: IToken) {
		sessionStorage.setItem(this.tokenKey, token.jwt);
	}
	getToken() {
		return sessionStorage.getItem(this.tokenKey);
	}
	logout() {
		sessionStorage.removeItem(this.tokenKey);
	}
}
