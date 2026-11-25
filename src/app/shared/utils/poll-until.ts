import {Observable, Subscription, timer} from 'rxjs';

/**
 * Intervalle avant une requête : fixe, ou calculé à partir de la tentative à venir (`attempt`, 1-based) et du
 * temps déjà écoulé depuis le début de l'interrogation (`elapsedMs`, délai initial compris). Permet par exemple
 * une phase rapide suivie d'un ralentissement (`(attempt, elapsedMs) => elapsedMs < 10_000 ? 2_000 : 5_000`).
 */
export type PollInterval = number | ((attempt: number, elapsedMs: number) => number);

export interface PollOptions<T> {
	/** Intervalle avant chaque requête (ms). */
	intervalMs: PollInterval;
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
 * Interroge `request`, à un intervalle fixe ou variable (`intervalMs`), et émet chaque résultat, jusqu'à ce que
 * `isDone` soit vérifié (fin normale), que `continueWhile` devienne faux (fin normale) ou que `maxAttempts` soit
 * atteint (erreur `PollTimeoutError`). Une requête encore en cours au tick suivant n'est pas annulée : elles ne se
 * chevauchent pas, le prochain délai n'étant programmé qu'après la réception de la précédente.
 */
export function pollUntil<T>(request: () => Observable<T>, options: PollOptions<T>): Observable<T> {
	const {intervalMs, initialDelayMs = 0, maxAttempts = Infinity, isDone, continueWhile = () => true} = options;
	const delayFor = (attempt: number, elapsedMs: number): number => (typeof intervalMs === 'function' ? intervalMs(attempt, elapsedMs) : intervalMs);

	return new Observable<T>(subscriber => {
		let attempts = 0;
		let elapsedMs = 0;
		let timerSub: Subscription | undefined;
		let requestSub: Subscription | undefined;

		const scheduleNext = (delay: number): void => {
			elapsedMs += delay;
			timerSub = timer(delay).subscribe(runAttempt);
		};

		const runAttempt = (): void => {
			if (!continueWhile()) {
				subscriber.complete();
				return;
			}
			attempts++;
			requestSub = request().subscribe({
				next: value => {
					subscriber.next(value);
					if (isDone(value)) {
						subscriber.complete();
					} else if (attempts >= maxAttempts) {
						subscriber.error(new PollTimeoutError(attempts));
					} else {
						scheduleNext(delayFor(attempts + 1, elapsedMs));
					}
				},
				error: error => subscriber.error(error)
			});
		};

		scheduleNext(initialDelayMs);

		return () => {
			timerSub?.unsubscribe();
			requestSub?.unsubscribe();
		};
	});
}
