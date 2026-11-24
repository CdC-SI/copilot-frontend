import {of} from 'rxjs';
import {aSource} from '../../../../testing/stream-events';
import {SourceViewerStore} from './source-viewer.store';

describe('SourceViewerStore', () => {
	const first = aSource({documentId: 'chunk-1', citation: 1});
	const unresolvable = aSource({documentId: undefined, citation: 2, type: 'URL', link: 'https://example.ch'});
	const third = aSource({documentId: 'chunk-3', citation: 3});
	let store: SourceViewerStore;

	beforeEach(() => {
		jest.useFakeTimers();
		store = new SourceViewerStore();
	});

	afterEach(() => {
		document.body.replaceChildren();
		jest.useRealTimers();
	});

	it('ne s’ouvre que pour une source résoluble par le backend', () => {
		expect(SourceViewerStore.canOpen(first)).toBe(true);
		expect(SourceViewerStore.canOpen(unresolvable)).toBe(false);
		expect(SourceViewerStore.canOpen(undefined)).toBe(false);

		store.open(unresolvable, [first, unresolvable]);

		expect(store.isOpen()).toBe(false);
	});

	it('navigue entre les sources résolubles de la réponse', () => {
		store.open(third, [first, unresolvable, third]);

		expect(store.target()).toEqual({kind: 'source', source: third});
		expect(store.position()).toEqual({current: 2, total: 2});
		expect(store.hasNext()).toBe(false);
		expect(store.hasPrevious()).toBe(true);

		store.previous();
		expect(store.target()).toEqual({kind: 'source', source: first});
		expect(store.hasPrevious()).toBe(false);
		store.previous();
		expect(store.position().current).toBe(1);

		store.next();
		expect(store.target()).toEqual({kind: 'source', source: third});
		store.next();
		expect(store.position().current).toBe(2);
	});

	it('retrouve la source par identifiant et citation quand l’objet diffère (liste recopiée)', () => {
		store.open({...third}, [first, third]);

		expect(store.position()).toEqual({current: 2, total: 2});
		expect(store.target()).toEqual({kind: 'source', source: third});
	});

	it('ouvre une source absente de la liste seule, sans navigation', () => {
		const other = aSource({documentId: 'chunk-9', citation: 9});

		store.open(other, [first]);

		expect(store.target()).toEqual({kind: 'source', source: other});
		expect(store.position()).toEqual({current: 1, total: 1});
		expect(store.hasNext()).toBe(false);
	});

	it('ouvre un document du corpus', () => {
		const load = () => of(new Blob(['%PDF']));

		store.openFile('note.pdf', load);

		expect(store.target()).toEqual({kind: 'file', title: 'note.pdf', load});
		expect(store.position()).toEqual({current: 1, total: 0});
		store.next();
		expect(store.target()?.kind).toBe('file');
	});

	it('rend le focus au déclencheur à la fermeture', () => {
		const opener = document.createElement('button');
		document.body.append(opener);
		opener.focus();

		store.open(first, [first, third]);
		store.next();
		store.close();
		jest.runAllTimers();

		expect(store.isOpen()).toBe(false);
		expect(document.activeElement).toBe(opener);
	});

	it('ne rend pas le focus à un déclencheur retiré du document, et ignore une double fermeture', () => {
		const opener = document.createElement('button');
		document.body.append(opener);
		opener.focus();
		store.open(first);
		opener.remove();

		store.close();
		store.close();
		jest.runAllTimers();

		expect(document.activeElement).toBe(document.body);
	});

	it('mémorise le déclencheur de chaque ouverture, pas celui de la navigation', () => {
		const firstPill = document.createElement('button');
		const secondPill = document.createElement('button');
		document.body.append(firstPill, secondPill);
		firstPill.focus();
		store.open(first, [first, third]);
		secondPill.focus();
		store.open(third, [first, third]);
		firstPill.focus();
		store.previous();

		store.close();
		jest.runAllTimers();

		expect(document.activeElement).toBe(secondPill);
	});

	describe('sources de la réponse mises à jour (streaming)', () => {
		const second = aSource({documentId: 'chunk-2', citation: 2});

		it('reprend les nouvelles sources de la réponse d’origine sans changer la source affichée', () => {
			store.open(first, [first], 'message-1');
			const target = store.target();

			store.syncSources('message-1', [{...first}, unresolvable, second, third]);

			expect(store.target()).toBe(target);
			expect(store.position()).toEqual({current: 1, total: 3});
			store.next();
			expect(store.target()).toEqual({kind: 'source', source: second});
		});

		it('suit la source affichée si son rang change', () => {
			store.open(third, [first, third], 'message-1');

			store.syncSources('message-1', [first, second, third]);

			expect(store.position()).toEqual({current: 3, total: 3});
		});

		it('ignore les autres réponses, une liste inchangée ou sans la source affichée', () => {
			store.open(first, [first], 'message-1');
			const before = store.position();

			store.syncSources('message-2', [first, second]);
			store.syncSources('message-1', [first]);
			store.syncSources('message-1', [second, third]);

			expect(store.position()).toBe(before);
		});

		it('ne concerne pas un document du corpus', () => {
			store.openFile('note.pdf', () => of(new Blob()));

			store.syncSources('message-1', [first]);

			expect(store.target()?.kind).toBe('file');
		});
	});
});
