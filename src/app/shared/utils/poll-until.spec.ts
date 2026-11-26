import {Observable, Subject, of, throwError} from 'rxjs';
import {take} from 'rxjs/operators';
import {PollTimeoutError, pollUntil} from './poll-until';

describe('pollUntil', () => {
	let values: number[];
	let errors: unknown[];
	let completed: boolean;
	let calls: number;

	const observe = (source: Observable<number>) =>
		source.subscribe({
			next: value => values.push(value),
			error: error => errors.push(error),
			complete: () => (completed = true)
		});

	/** Requête renvoyant successivement 1, 2, 3… */
	const counter = () => of(++calls);

	beforeEach(() => {
		jest.useFakeTimers();
		values = [];
		errors = [];
		completed = false;
		calls = 0;
	});

	afterEach(() => jest.useRealTimers());

	it('interroge immédiatement puis à intervalle régulier, et se termine quand isDone est vérifié', () => {
		observe(pollUntil(counter, {intervalMs: 1000, isDone: value => value === 3}));

		jest.advanceTimersByTime(0);
		expect(values).toEqual([1]);
		jest.advanceTimersByTime(999);
		expect(values).toEqual([1]);
		jest.advanceTimersByTime(1);
		expect(values).toEqual([1, 2]);
		jest.advanceTimersByTime(1000);
		expect(values).toEqual([1, 2, 3]);
		expect(completed).toBe(true);

		jest.advanceTimersByTime(5000);
		expect(calls).toBe(3);
		expect(errors).toEqual([]);
	});

	it('respecte le délai initial', () => {
		observe(pollUntil(counter, {intervalMs: 1000, initialDelayMs: 3000, isDone: () => false}));

		jest.advanceTimersByTime(2999);
		expect(calls).toBe(0);
		jest.advanceTimersByTime(1);
		expect(values).toEqual([1]);
		jest.advanceTimersByTime(1000);
		expect(values).toEqual([1, 2]);
	});

	it('signale le dépassement du nombre maximal de tentatives par PollTimeoutError', () => {
		observe(pollUntil(counter, {intervalMs: 1000, maxAttempts: 3, isDone: () => false}));

		jest.advanceTimersByTime(10_000);
		expect(values).toEqual([1, 2, 3]);
		expect(errors).toHaveLength(1);
		expect(errors[0]).toBeInstanceOf(PollTimeoutError);
		expect((errors[0] as PollTimeoutError).attempts).toBe(3);
		expect(completed).toBe(false);
	});

	it("ne signale pas de dépassement si la dernière tentative termine l'interrogation", () => {
		observe(pollUntil(counter, {intervalMs: 1000, maxAttempts: 3, isDone: value => value === 3}));

		jest.advanceTimersByTime(10_000);
		expect(values).toEqual([1, 2, 3]);
		expect(errors).toEqual([]);
		expect(completed).toBe(true);
	});

	it("s'arrête sans requête quand continueWhile devient faux", () => {
		let pending = true;
		observe(pollUntil(counter, {intervalMs: 1000, isDone: () => false, continueWhile: () => pending}));

		jest.advanceTimersByTime(1000);
		expect(calls).toBe(2);
		pending = false;
		jest.advanceTimersByTime(1000);
		expect(calls).toBe(2);
		expect(completed).toBe(true);
		expect(errors).toEqual([]);
	});

	it("isDone est évalué après l'émission (l'abonné a déjà appliqué le résultat)", () => {
		let applied = 0;
		pollUntil(counter, {intervalMs: 1000, isDone: () => applied >= 2}).subscribe(value => (applied = value));

		jest.advanceTimersByTime(10_000);
		expect(calls).toBe(2);
	});

	it("propage l'erreur d'une requête", () => {
		const failure = new Error('HTTP 500');
		observe(pollUntil(() => throwError(() => failure), {intervalMs: 1000, isDone: () => false}));

		jest.advanceTimersByTime(0);
		expect(errors).toEqual([failure]);
		jest.advanceTimersByTime(5000);
		expect(errors).toHaveLength(1);
	});

	it('accepte un intervalle variable, calculé à partir de la tentative et du temps écoulé', () => {
		const intervalMs = jest.fn((attempt: number, elapsedMs: number) => (elapsedMs < 3000 ? 1000 : 2000));
		observe(pollUntil(counter, {intervalMs, isDone: () => false}));

		jest.advanceTimersByTime(0);
		expect(values).toEqual([1]);
		jest.advanceTimersByTime(1000);
		expect(values).toEqual([1, 2]); // elapsedMs=0 -> 1000ms
		jest.advanceTimersByTime(1000);
		expect(values).toEqual([1, 2, 3]); // elapsedMs=1000 -> 1000ms
		jest.advanceTimersByTime(1000);
		expect(values).toEqual([1, 2, 3, 4]); // elapsedMs=2000 -> 1000ms (total 3000)
		jest.advanceTimersByTime(1999);
		expect(values).toEqual([1, 2, 3, 4]); // elapsedMs=3000 -> 2000ms, pas encore écoulé
		jest.advanceTimersByTime(1);
		expect(values).toEqual([1, 2, 3, 4, 5]);
		expect(intervalMs).toHaveBeenCalledWith(2, 0);
		expect(intervalMs).toHaveBeenCalledWith(5, 3000);
	});

	it('calcule elapsedMs sur le temps réel écoulé, y compris la durée des requêtes (pas seulement les délais programmés)', () => {
		/** Requête renvoyant un résultat après `delayMs` de latence réseau, comme un appel HTTP réel (next + complete). */
		const slowRequest = (delayMs: number) => () => {
			const result = new Subject<number>();
			setTimeout(() => {
				result.next(++calls);
				result.complete();
			}, delayMs);
			return result;
		};

		const intervalMs = jest.fn((attempt: number, elapsedMs: number) => (elapsedMs < 10_000 ? 2000 : 5000));
		observe(pollUntil(slowRequest(4000), {intervalMs, isDone: () => false}));

		jest.advanceTimersByTime(4000); // 1ère réponse reçue à t=4000ms
		expect(values).toEqual([1]);
		expect(intervalMs).toHaveBeenLastCalledWith(2, 4000);

		jest.advanceTimersByTime(2000); // délai rapide (4000<10000) -> 2ème requête lancée à t=6000ms
		jest.advanceTimersByTime(4000); // 2ème réponse reçue à t=10000ms (temps réel, pas seulement les délais)
		expect(values).toEqual([1, 2]);
		expect(intervalMs).toHaveBeenLastCalledWith(3, 10_000);

		jest.advanceTimersByTime(4999);
		expect(values).toEqual([1, 2]); // délai lent (5000ms) pas encore écoulé
		jest.advanceTimersByTime(1);
		jest.advanceTimersByTime(4000); // 3ème réponse reçue à t=19000ms
		expect(values).toEqual([1, 2, 3]);
	});

	it('arrête de programmer de nouvelles requêtes si le désabonnement survient pendant subscriber.next (ex. take(1))', () => {
		observe(pollUntil(counter, {intervalMs: 1000, isDone: () => false}).pipe(take(1)));

		jest.advanceTimersByTime(0);
		expect(values).toEqual([1]);
		expect(completed).toBe(true);

		jest.advanceTimersByTime(10_000);
		expect(calls).toBe(1); // aucune requête supplémentaire : le timer programmé après l'émission a été annulé
	});

	it("ne planifie la tentative suivante qu'à la complétion de la requête en cours, pas à chaque émission intermédiaire", () => {
		const response = new Subject<number>();
		const request = () => {
			calls++;
			return response;
		};

		observe(pollUntil(request, {intervalMs: 1000, isDone: () => false}));

		jest.advanceTimersByTime(0);
		response.next(1); // valeur « pending » : la requête reste ouverte (ni complete, ni erreur)
		expect(values).toEqual([1]);
		expect(calls).toBe(1);

		jest.advanceTimersByTime(5000);
		expect(calls).toBe(1); // aucune nouvelle requête tant que la précédente reste ouverte

		response.next(2); // seconde émission sur la même requête (toujours pas de complete)
		expect(values).toEqual([1, 2]);
		expect(calls).toBe(1);

		response.complete(); // la requête se termine enfin
		jest.advanceTimersByTime(1000);
		expect(calls).toBe(2); // la tentative suivante n'est désormais planifiée qu'après cette complétion
	});

	it("le désabonnement arrête l'interrogation après plusieurs tentatives déjà effectuées", () => {
		const response = new Subject<number>();
		const request = () => {
			calls++;
			return calls <= 2 ? of(calls) : response; // 2 premières tentatives synchrones, 3ème reste ouverte
		};

		const subscription = observe(pollUntil(request, {intervalMs: 1000, isDone: () => false}));

		jest.advanceTimersByTime(0); // 1ère tentative (synchrone, complete) -> calls=1
		jest.advanceTimersByTime(1000); // 2ème tentative -> calls=2
		jest.advanceTimersByTime(1000); // 3ème tentative -> calls=3, reste ouverte (response)
		expect(calls).toBe(3);
		response.next(3); // valeur de la 3ème tentative, qui reste ensuite ouverte (pas de complete)
		expect(values).toEqual([1, 2, 3]);

		subscription.unsubscribe();
		expect(response.observed).toBe(false);

		jest.advanceTimersByTime(10_000);
		expect(calls).toBe(3); // aucune tentative supplémentaire après plusieurs cycles de polling
		expect(completed).toBe(false);
	});

	it("le désabonnement arrête l'interrogation et annule la requête en cours", () => {
		const response = new Subject<number>();
		const subscription = observe(
			pollUntil(
				() => {
					calls++;
					return response;
				},
				{intervalMs: 1000, isDone: () => false}
			)
		);

		jest.advanceTimersByTime(0);
		subscription.unsubscribe();
		expect(response.observed).toBe(false);
		jest.advanceTimersByTime(5000);
		expect(calls).toBe(1);
		expect(completed).toBe(false);
	});
});
