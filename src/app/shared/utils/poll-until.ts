import {Observable, switchMap, takeWhile, timer} from 'rxjs';

export interface PollOptions<T> {
	/** Intervalle entre deux requêtes (ms). */
	intervalMs: number;
	/** Délai avant la première requête (ms) ; 0 par défaut (requête immédiate). */
	initialDelayMs?: number;
	/** Nombre maximal de requêtes ; au-delà, le flux se termine en erreur `PollTimeoutError`. Illimité par défaut. */
	maxAttempts?: number;
	/** Évalué après l'émission de chaque résultat : `true` termine le flux. */
	isDone: (value: T) => boolean;
	/** Condition sur l'état local, vérifiée avant chaque requête : `false` termine le flux sans requête. */
	continueWhile?: () => boolean;
}

/** Nombre maximal de requêtes atteint sans que `isDone` soit vérifié. */
export class PollTimeoutError extends Error {
	constructor(readonly attempts: number) {
		super(`Polling arrêté après ${attempts} tentatives`);
		this.name = 'PollTimeoutError';
	}
}

/**
 * Interroge `request` à intervalle régulier et émet chaque résultat, jusqu'à ce que `isDone` soit vérifié
 * (fin normale), que `continueWhile` devienne faux (fin normale) ou que `maxAttempts` soit atteint
 * (erreur `PollTimeoutError`). Une requête encore en cours au tick suivant est annulée (`switchMap`).
 */
export function pollUntil<T>(request: () => Observable<T>, options: PollOptions<T>): Observable<T> {
	const {intervalMs, initialDelayMs = 0, maxAttempts = Infinity, isDone, continueWhile = () => true} = options;
	return new Observable<T>(subscriber => {
		let attempts = 0;
		const subscription = timer(initialDelayMs, intervalMs)
			.pipe(
				takeWhile(() => attempts < maxAttempts && continueWhile()),
				switchMap(() => {
					attempts++;
					return request();
				})
			)
			.subscribe({
				next: value => {
					subscriber.next(value);
					if (isDone(value)) {
						subscriber.complete();
					} else if (attempts >= maxAttempts) {
						subscriber.error(new PollTimeoutError(attempts));
					}
				},
				error: error => subscriber.error(error),
				complete: () => subscriber.complete()
			});
		return () => subscription.unsubscribe();
	});
}
