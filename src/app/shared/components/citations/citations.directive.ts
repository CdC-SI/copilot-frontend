import {ComponentRef, DestroyRef, Directive, ElementRef, Injector, effect, inject, input, output} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {OverlayRef, createCloseScrollStrategy, createFlexibleConnectedPositionStrategy, createOverlayRef} from '@angular/cdk/overlay';
import {ComponentPortal} from '@angular/cdk/portal';
import {TranslateService} from '@ngx-translate/core';
import {MarkdownComponent} from 'ngx-markdown';
import {MessageSource} from '../../model/chat-history';
import {citedSource, sourceLabel, splitCitations} from '../../utils/citations';
import {CitationCardComponent} from './citation-card.component';

const PILL_CLASS = 'citation-pill';
const HAS_MARKER = /\[\^\d{1,3}]/;
/** Délai avant fermeture de l'aperçu : laisse le temps de passer de la pastille à l'aperçu (et inversement). */
const CLOSE_DELAY_MS = 200;
let nextCardId = 0;

/**
 * Citations d'une réponse (F2c) : après chaque rendu du `<markdown>` hôte, les marqueurs `[^n]` du texte (hors code)
 * deviennent des pastilles cliquables `n`. Survol ou focus : aperçu de la source (`CitationCardComponent`), conservé
 * tant que la pastille a le focus ou que la pastille ou l'aperçu est survolé, fermé par Échap ;
 * clic, Entrée ou Espace : `citationSelected` (n).
 *
 * Les pastilles sont créées dans le DOM produit par ngx-markdown (texte inséré via `textContent`, jamais en HTML).
 */
@Directive({
	selector: 'markdown[zcoCitations]',
	host: {
		'(mouseover)': 'onPointer($event, true)',
		'(mouseout)': 'onPointer($event, false)',
		'(focusin)': 'onPointer($event, true)',
		'(focusout)': 'onPointer($event, false)',
		'(click)': 'onClick($event)',
		'(document:keydown.escape)': 'closeCard()'
	}
})
export class CitationsDirective {
	/** Sources de la réponse (numéro de citation dans `citation`). */
	readonly sources = input<MessageSource[] | undefined>(undefined, {alias: 'zcoCitations'});
	readonly citationSelected = output<number>();

	private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
	private readonly translate = inject(TranslateService);
	private readonly injector = inject(Injector);
	private overlayRef?: OverlayRef;
	private card?: ComponentRef<CitationCardComponent>;
	private anchor?: HTMLElement;
	private hoveredPill?: HTMLElement;
	private cardHovered = false;
	private closeTimer?: ReturnType<typeof setTimeout>;

	constructor() {
		inject(MarkdownComponent)
			.ready.pipe(takeUntilDestroyed())
			.subscribe(() => this.hydrate());
		this.translate.onLangChange.pipe(takeUntilDestroyed()).subscribe(() => this.refresh(this.sources()));
		effect(() => this.refresh(this.sources()));
		inject(DestroyRef).onDestroy(() => {
			clearTimeout(this.closeTimer);
			this.overlayRef?.dispose();
		});
	}

	/** Remplace les marqueurs du rendu courant par des pastilles. */
	hydrate(): void {
		this.closeCard();
		const root = this.host.nativeElement;
		const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
			acceptNode: node =>
				node.parentElement?.closest(`code, pre, .${PILL_CLASS}`) || !HAS_MARKER.test(node.nodeValue ?? '') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
		});
		const nodes: Text[] = [];
		while (walker.nextNode()) nodes.push(walker.currentNode as Text);
		nodes.forEach(node => this.replaceMarkers(node));
		this.refresh(this.sources());
	}

	closeCard(): void {
		clearTimeout(this.closeTimer);
		this.anchor?.removeAttribute('aria-describedby');
		this.anchor = undefined;
		this.cardHovered = false;
		this.overlayRef?.detach();
		this.card = undefined;
	}

	protected onPointer(event: Event, entering: boolean): void {
		const pill = this.pillOf(event.target);
		if (!pill) return;
		if (event.type.startsWith('mouse')) {
			this.hoveredPill = entering ? pill : this.hoveredPill === pill ? undefined : this.hoveredPill;
		}
		if (entering) {
			this.openCard(pill);
			return;
		}
		const next = (event as MouseEvent | FocusEvent).relatedTarget;
		if (!(next instanceof Node && pill.contains(next))) {
			this.scheduleClose();
		}
	}

	protected onClick(event: Event): void {
		const pill = this.pillOf(event.target);
		if (!pill) return;
		event.preventDefault();
		this.closeCard();
		this.citationSelected.emit(Number(pill.dataset['citation']));
	}

	private replaceMarkers(node: Text): void {
		const doc = node.ownerDocument;
		const fragment = doc.createDocumentFragment();
		for (const part of splitCitations(node.nodeValue ?? '')) {
			if (typeof part === 'string') {
				fragment.append(doc.createTextNode(part));
				continue;
			}
			const pill = doc.createElement('button');
			pill.type = 'button';
			pill.className = PILL_CLASS;
			pill.dataset['citation'] = String(part);
			pill.textContent = String(part);
			fragment.append(pill);
		}
		node.replaceWith(fragment);
	}

	/** Libellés accessibles des pastilles et aperçu ouvert, d'après les sources connues. */
	private refresh(sources: MessageSource[] | undefined): void {
		this.host.nativeElement.querySelectorAll<HTMLElement>(`.${PILL_CLASS}`).forEach(pill => {
			const n = Number(pill.dataset['citation']);
			const source = citedSource(sources, n);
			const label: string = source
				? this.translate.instant('chat.citation.label', {n, label: sourceLabel(source)})
				: this.translate.instant('chat.citation.unknown', {n});
			pill.setAttribute('aria-label', label);
		});
		if (this.card && this.anchor) {
			this.card.setInput('source', citedSource(sources, Number(this.anchor.dataset['citation'])));
		}
	}

	private openCard(pill: HTMLElement): void {
		clearTimeout(this.closeTimer);
		if (this.anchor === pill) return;
		this.closeCard();
		this.overlayRef ??= this.createOverlay();
		this.overlayRef.updatePositionStrategy(
			createFlexibleConnectedPositionStrategy(this.injector, pill).withPositions([
				{originX: 'center', originY: 'top', overlayX: 'center', overlayY: 'bottom', offsetY: -6},
				{originX: 'center', originY: 'bottom', overlayX: 'center', overlayY: 'top', offsetY: 6}
			])
		);
		const n = Number(pill.dataset['citation']);
		const cardId = `zco-citation-card-${nextCardId++}`;
		this.card = this.overlayRef.attach(new ComponentPortal(CitationCardComponent, null, this.injector));
		this.card.setInput('n', n);
		this.card.setInput('source', citedSource(this.sources(), n));
		this.card.setInput('cardId', cardId);
		pill.setAttribute('aria-describedby', cardId);
		this.anchor = pill;
	}

	private createOverlay(): OverlayRef {
		const overlayRef = createOverlayRef(this.injector, {scrollStrategy: createCloseScrollStrategy(this.injector)});
		overlayRef.overlayElement.addEventListener('mouseenter', () => {
			this.cardHovered = true;
			clearTimeout(this.closeTimer);
		});
		overlayRef.overlayElement.addEventListener('mouseleave', () => {
			this.cardHovered = false;
			this.scheduleClose();
		});
		return overlayRef;
	}

	/** Ferme l'aperçu après un délai, sauf si la pastille a le focus ou si la pastille ou l'aperçu est survolé. */
	private scheduleClose(): void {
		clearTimeout(this.closeTimer);
		this.closeTimer = setTimeout(() => {
			const anchor = this.anchor;
			if (anchor && this.hoveredPill !== anchor && !this.cardHovered && anchor.ownerDocument.activeElement !== anchor) {
				this.closeCard();
			}
		}, CLOSE_DELAY_MS);
	}

	private pillOf(target: EventTarget | null): HTMLElement | null {
		const pill = target instanceof Element ? target.closest<HTMLElement>(`.${PILL_CLASS}`) : null;
		return pill && this.host.nativeElement.contains(pill) ? pill : null;
	}
}
