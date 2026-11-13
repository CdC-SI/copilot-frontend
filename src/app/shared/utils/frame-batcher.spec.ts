import {FrameBatcher} from './frame-batcher';

describe('FrameBatcher', () => {
	let callbacks: (() => void)[];
	let processed: string[][];
	let batcher: FrameBatcher<string>;
	const cancel = jest.fn();

	beforeEach(() => {
		callbacks = [];
		processed = [];
		cancel.mockReset();
		batcher = new FrameBatcher<string>(
			items => processed.push(items),
			cb => callbacks.push(cb),
			cancel
		);
	});

	it('regroupe les éléments reçus avant la frame suivante', () => {
		batcher.push('a');
		batcher.push('b');
		batcher.push('c');

		expect(callbacks).toHaveLength(1);
		expect(processed).toEqual([]);

		callbacks[0]();
		expect(processed).toEqual([['a', 'b', 'c']]);
	});

	it('planifie une nouvelle frame après traitement', () => {
		batcher.push('a');
		callbacks[0]();
		batcher.push('b');

		expect(callbacks).toHaveLength(2);
		callbacks[1]();
		expect(processed).toEqual([['a'], ['b']]);
	});

	it('flush traite immédiatement et annule la frame planifiée', () => {
		batcher.push('a');
		batcher.flush();

		expect(processed).toEqual([['a']]);
		expect(cancel).toHaveBeenCalledWith(1);
	});

	it("flush sans élément en attente n'appelle pas le traitement", () => {
		batcher.flush();
		expect(processed).toEqual([]);
	});
});
