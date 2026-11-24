import {Injectable, computed, signal} from '@angular/core';
import {Observable} from 'rxjs';
import {MessageSource} from '../../model/chat-history';

/**
 * Contenu du panneau des sources :
 * - `source` : source d'une réponse, résolue par le backend (`/api/source-documents/{documentId}`) ;
 * - `file` : document déjà identifié (corpus personnel), chargé par `load`.
 */
export type SourceViewerTarget = {kind: 'source'; source: MessageSource} | {kind: 'file'; title: string; load: () => Observable<Blob>};

interface SourceViewerState {
	target: SourceViewerTarget | null;
	/** Sources parcourues par précédent / suivant (celles de la réponse, citées d'abord). */
	sources: MessageSource[];
	index: number;
	/** Réponse d'origine (`clientId` du message) : ses sources mises à jour (streaming) sont reprises. */
	owner?: string;
}

/**
 * État du panneau latéral des sources, fourni par la page qui l'affiche (chat, corpus). Les composants partagés
 * l'injectent en option : sans panneau, ils gardent leur comportement d'origine (téléchargement, lien externe).
 */
@Injectable()
export class SourceViewerStore {
	readonly target = computed(() => this.state().target);
	readonly isOpen = computed(() => !!this.state().target);
	readonly position = computed(() => ({current: this.state().index + 1, total: this.state().sources.length}));
	readonly hasPrevious = computed(() => this.state().index > 0);
	readonly hasNext = computed(() => this.state().index < this.state().sources.length - 1);
	private readonly state = signal<SourceViewerState>({target: null, sources: [], index: 0});
	/** Élément à qui rendre le focus à la fermeture (déclencheur de l'ouverture). */
	private returnFocus?: HTMLElement;

	/** Une source s'ouvre dans le panneau si le backend peut la résoudre (identifiant du chunk, de la pièce jointe…). */
	static canOpen(source: MessageSource | undefined): boolean {
		return !!source?.documentId;
	}

	/**
	 * Ouvre une source ; `sources` (sources de la même réponse) alimente la navigation précédent / suivant et
	 * `owner` identifie la réponse pour suivre ses sources (`syncSources`).
	 */
	open(source: MessageSource, sources: MessageSource[] = [source], owner?: string): void {
		if (!SourceViewerStore.canOpen(source)) return;
		const navigable = sources.filter(s => SourceViewerStore.canOpen(s));
		let index = navigable.indexOf(source);
		if (index < 0) index = navigable.findIndex(s => sameSource(s, source));
		this.rememberFocus();
		this.state.set(
			index < 0
				? {target: {kind: 'source', source}, sources: [source], index: 0, owner}
				: {target: {kind: 'source', source: navigable[index]}, sources: navigable, index, owner}
		);
	}

	openFile(title: string, load: () => Observable<Blob>): void {
		this.rememberFocus();
		this.state.set({target: {kind: 'file', title, load}, sources: [], index: 0});
	}

	/**
	 * Sources à jour de la réponse `owner` (nouvelles citations pendant le streaming) : la navigation les reprend,
	 * la source affichée reste la même (pas de rechargement).
	 */
	syncSources(owner: string, sources: MessageSource[]): void {
		const state = this.state();
		if (state.target?.kind !== 'source' || state.owner !== owner) return;
		const navigable = sources.filter(s => SourceViewerStore.canOpen(s));
		const current = state.target.source;
		const index = navigable.findIndex(s => sameSource(s, current));
		if (index < 0 || (navigable.length === state.sources.length && navigable.every((s, i) => s === state.sources[i]))) return;
		this.state.set({...state, sources: navigable, index});
	}

	previous(): void {
		this.move(-1);
	}

	next(): void {
		this.move(1);
	}

	close(): void {
		if (!this.isOpen()) return;
		this.state.set({target: null, sources: [], index: 0});
		const element = this.returnFocus;
		this.returnFocus = undefined;
		if (element?.isConnected) setTimeout(() => element.focus());
	}

	private move(step: number): void {
		const {sources, index} = this.state();
		const next = index + step;
		if (next < 0 || next >= sources.length) return;
		this.state.update(state => ({...state, target: {kind: 'source', source: sources[next]}, index: next}));
	}

	/** Déclencheur de chaque ouverture (pastille, bouton) ; précédent / suivant ne le modifient pas. */
	private rememberFocus(): void {
		const active = document.activeElement;
		this.returnFocus = active instanceof HTMLElement && active !== document.body ? active : undefined;
	}
}

/** Même source : même chunk et même numéro de citation (objets recréés par le streaming). */
function sameSource(a: MessageSource, b: MessageSource): boolean {
	return a.documentId === b.documentId && a.citation === b.citation;
}
