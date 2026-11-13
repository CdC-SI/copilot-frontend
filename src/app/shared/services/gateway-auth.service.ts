import {Injectable} from '@angular/core';
import {MatDialog} from '@angular/material/dialog';
import {take} from 'rxjs/operators';
import {nanoid} from 'nanoid';
import {AuthenticationDialogComponent, EnvironmentService, LocalStorageService} from 'zas-design-system';
import {AuthenticationServiceV2} from './auth.service';

/** Accès minimal aux en-têtes, commun à `HttpHeaders` (HttpClient) et `Headers` (fetch). */
export interface HeaderReader {
	get: (name: string) => string | null;
}

/**
 * Logique d'authentification de la Blue Gateway, partagée entre `BlueGatewayInterceptorV2` (HttpClient)
 * et le client de streaming (fetch) : en-têtes sortants, rafraîchissement du jeton, dialogue d'expiration.
 */
@Injectable({providedIn: 'root'})
export class GatewayAuthService {
	static readonly TOKEN_HEADER = 'blue';
	static readonly CORRELATION_HEADER = 'X-Correlation-Id';

	constructor(
		private readonly dialog: MatDialog,
		private readonly authenticationService: AuthenticationServiceV2,
		private readonly localStorageService: LocalStorageService,
		private readonly environmentService: EnvironmentService
	) {}

	isLocalhost(): boolean {
		return this.environmentService.getIsLocalhostEnvironment();
	}

	requestHeaders(): Record<string, string> {
		const token = this.isLocalhost() ? this.environmentService.getMockToken() : this.authenticationService.jwtToken;
		return {
			[GatewayAuthService.CORRELATION_HEADER]: nanoid(),
			[GatewayAuthService.TOKEN_HEADER]: `Bearer ${token}`
		};
	}

	/** Vérifie que la session n'a pas été fermée depuis un autre onglet (l'expiration est aussi contrôlée par la gateway). */
	checkSession(): void {
		if (this.authenticationService.jwtToken && !this.localStorageService.isConnected()) {
			this.displayUnauthorized();
		}
	}

	/** La gateway renvoie un nouveau jeton dans l'en-tête `blue` lorsqu'il a été rafraîchi. */
	refreshToken(headers: HeaderReader): void {
		const token = headers.get(GatewayAuthService.TOKEN_HEADER);
		if (token) {
			this.authenticationService.jwtToken = token;
		}
	}

	displayUnauthorized(): void {
		if (this.dialog.getDialogById('unauthorized')) {
			return;
		}
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
