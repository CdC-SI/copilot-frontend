import {ErrorHandler, Injectable, Injector, NgZone} from '@angular/core';
import {HttpErrorResponse} from '@angular/common/http';
import {ObNotificationService} from '@oblique/oblique';

/**
 * Filet de sécurité pour les erreurs non interceptées : log console + notification utilisateur.
 * Les erreurs HTTP sont déjà notifiées par `ObHttpApiInterceptor`, elles ne sont donc que loggées.
 */
@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
	constructor(
		private readonly injector: Injector,
		private readonly zone: NgZone
	) {}

	handleError(error: unknown): void {
		console.error(error);
		if (this.isHttpError(error)) {
			return;
		}
		// Résolution paresseuse pour éviter une dépendance circulaire à l'initialisation.
		const notif = this.injector.get(ObNotificationService, null);
		this.zone.run(() => notif?.error('i18n.oblique.http.error.general'));
	}

	private isHttpError(error: unknown): boolean {
		const rejection = (error as {rejection?: unknown} | null)?.rejection;
		return error instanceof HttpErrorResponse || rejection instanceof HttpErrorResponse;
	}
}
