type Schedule = (callback: () => void) => number;
type Cancel = (handle: number) => void;

/**
 * Regroupe des éléments reçus en rafale et les traite une seule fois par frame d'affichage
 * (requestAnimationFrame), pour limiter les re-rendus (ex. Markdown) pendant un streaming.
 */
export class FrameBatcher<T> {
	private pending: T[] = [];
	private handle: number | null = null;

	constructor(
		private readonly process: (items: T[]) => void,
		private readonly schedule: Schedule = callback => requestAnimationFrame(callback),
		private readonly cancelScheduled: Cancel = handle => cancelAnimationFrame(handle)
	) {}

	push(item: T): void {
		this.pending.push(item);
		if (this.handle === null) {
			this.handle = this.schedule(() => {
				this.handle = null;
				this.flush();
			});
		}
	}

	/** Traite immédiatement les éléments en attente (fin de flux, annulation). */
	flush(): void {
		this.cancelFrame();
		if (!this.pending.length) return;
		const items = this.pending;
		this.pending = [];
		this.process(items);
	}

	private cancelFrame(): void {
		if (this.handle !== null) {
			this.cancelScheduled(this.handle);
			this.handle = null;
		}
	}
}
