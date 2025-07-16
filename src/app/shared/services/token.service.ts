import {Injectable} from '@angular/core';
import {HttpHeaders} from '@angular/common/http';

@Injectable({
	providedIn: 'root'
})
export class TokenService {
	private blue?: Token;
	private green?: Token;

	setBlueToken(blue: Token) {
		this.blue = {...blue};
	}

	get blueToken() {
		return this.blue;
	}

	get greenToken() {
		return this.green;
	}

	public updateTokens(headers: HttpHeaders) {
		const green = headers.get(Tokens.GREEN);
		if (green) {
			this.green = new Token(green);
		}
		const blue = headers.get(Tokens.BLUE);
		if (blue) {
			this.blue = new Token(blue);
		}
	}

	public removeTokens() {
		this.green = null;
		this.blue = null;
	}

	public addTokenAsHeader(headers: HttpHeaders): HttpHeaders {
		if (this.greenToken) {
			headers = headers.set(Tokens.GREEN, this.greenToken.value);
		}
		if (this.blueToken) {
			headers = headers.set(Tokens.BLUE, this.blueToken.value);
		}
		return headers;
	}
}

export enum Tokens {
	BLUE = 'blue',
	GREEN = 'green'
}

export class Token {
	constructor(readonly value: string) {}

	static getAutoLoginBlueToken(): Token {
		return {
			value: 'TO REPLACE'
		};
	}
}
