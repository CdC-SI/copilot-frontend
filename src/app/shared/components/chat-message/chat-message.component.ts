import {ChangeDetectionStrategy, Component, ElementRef, EventEmitter, Input, Output, ViewChild, inject} from '@angular/core';
import {ChatMessage, ChatMessageSource} from '../../model/chat-message';
import {Feedback} from '../../model/feedback';
import {MarkdownComponent} from 'ngx-markdown';
import {WorkspaceBadgeComponent} from '../workspace-badge/workspace-badge.component';
import {MatTooltip} from '@angular/material/tooltip';
import {MatIcon} from '@angular/material/icon';
import {FormsModule} from '@angular/forms';
import {CdkTextareaAutosize} from '@angular/cdk/text-field';
import {MatExpansionPanel, MatExpansionPanelHeader, MatExpansionPanelTitle} from '@angular/material/expansion';
import {SourceListComponent} from '../source-list/source-list.component';
import {MessageActionComponent} from '../message-action/message-action.component';
import {TranslatePipe} from '@ngx-translate/core';
import {ToolApprovalRequest} from '../../model/tool-step';
import {ToolStepsComponent} from '../tool-steps/tool-steps.component';
import {CitationsDirective} from '../citations/citations.directive';
import {SourceViewerStore} from '../source-viewer/source-viewer.store';
import {sortSourcesByCitation} from '../../utils/citations';

const MIN_EDIT_WIDTH_PX = 240;

@Component({
	selector: 'zco-chat-message',
	templateUrl: './chat-message.component.html',
	styleUrl: './chat-message.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		MarkdownComponent,
		WorkspaceBadgeComponent,
		MatTooltip,
		MatIcon,
		FormsModule,
		CdkTextareaAutosize,
		MatExpansionPanel,
		MatExpansionPanelHeader,
		MatExpansionPanelTitle,
		SourceListComponent,
		MessageActionComponent,
		ToolStepsComponent,
		CitationsDirective,
		TranslatePipe
	]
})
export class ChatMessageComponent {
	@Input() previousMessage: ChatMessage;
	@Input() message: ChatMessage;
	@Input() conversationId: string;
	/** Message appartenant au dernier échange, qui peut être régénéré (réponse) ou modifié (question). */
	@Input() replayable = false;
	@Output() readonly feedback: EventEmitter<Feedback> = new EventEmitter<Feedback>();
	@Output() readonly workspaceChange = new EventEmitter<{question: string; workspace: string}>();
	@Output() readonly regenerate = new EventEmitter<void>();
	@Output() readonly editQuestion = new EventEmitter<string>();
	/** Arrêt de la génération en cours, demandé depuis la réponse. */
	@Output() readonly stop = new EventEmitter<void>();
	/** Décision sur une demande d'approbation d'outil de la réponse. */
	@Output() readonly toolApproval = new EventEmitter<ToolApprovalRequest>();
	@ViewChild('editInput') editInput?: ElementRef<HTMLTextAreaElement>;
	sourcePanelOpen: boolean;
	/** Source mise en évidence dans la liste après un clic sur sa pastille de citation. */
	highlightedCitation?: number;
	editing = false;
	editedQuestion = '';
	/** Largeur de la bulle figée pendant l'édition (px). */
	editWidth?: number;
	protected readonly ChatMessageSource = ChatMessageSource;
	private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
	private readonly viewer = inject(SourceViewerStore, {optional: true});
	/** Citation dont la carte doit recevoir le focus (clic sur une pastille, sans panneau des sources). */
	private pendingFocusCitation?: number;

	/** Réponse en cours de génération. */
	get isGenerating(): boolean {
		return this.message.source !== ChatMessageSource.USER && !this.message.isCompleted;
	}

	/** Statut d'avancement animé : seulement pendant la génération (une erreur finale garde son statut, figée). */
	get showsProgressStatus(): boolean {
		return this.isGenerating && !!this.message.status;
	}

	/** Barre d'actions (feedback, copier, régénérer) : réponse terminée et enregistrée. */
	get showActions(): boolean {
		return !!this.message.isCompleted && !this.message.inError && !(this.message.interrupted && !this.message.id);
	}

	sendFeedback(event: Feedback) {
		this.feedback.emit(event);
	}

	startEdit(): void {
		if (!this.replayable) return;
		this.editedQuestion = this.message.message ?? '';
		this.editWidth = Math.max(this.host.nativeElement.offsetWidth, MIN_EDIT_WIDTH_PX);
		this.editing = true;
		setTimeout(() => this.editInput?.nativeElement.focus());
	}

	cancelEdit(): void {
		this.editing = false;
	}

	submitEdit(): void {
		const question = this.editedQuestion.trim();
		if (!question || !this.replayable) return;
		this.editing = false;
		if (question !== this.message.message) {
			this.editQuestion.emit(question);
		}
	}

	submitEditOnEnter(event: Event): void {
		if ((event as KeyboardEvent).shiftKey) return;
		event.preventDefault();
		this.submitEdit();
	}

	/**
	 * Clic sur une pastille de citation : ouvre la source dans le panneau quand la page en a un, et met en évidence
	 * sa carte dans la liste des sources (focus sur la carte seulement sans panneau, qui prend lui-même le focus).
	 */
	showCitedSource(n: number): void {
		this.sourcePanelOpen = true;
		this.highlightedCitation = n;
		const sources = sortSourcesByCitation(this.message?.sources ?? []);
		const cited = sources.find(s => s.citation === n);
		const inViewer = !!this.viewer && SourceViewerStore.canOpen(cited);
		if (inViewer && cited) this.viewer?.open(cited, sources);
		this.pendingFocusCitation = inViewer ? undefined : n;
		setTimeout(() => {
			this.citedSourceCard(n)?.scrollIntoView({block: 'nearest', behavior: 'smooth'});
			this.focusPendingCitation();
		});
	}

	/**
	 * Donne le focus à la carte de la source citée. Tant que la liste des sources se déplie, son contenu est masqué
	 * et ne peut pas recevoir le focus : nouvel essai à la fin du dépliement (`afterExpand`).
	 */
	focusPendingCitation(): void {
		if (this.pendingFocusCitation === undefined) return;
		const card = this.citedSourceCard(this.pendingFocusCitation);
		card?.focus({preventScroll: true});
		if (card && document.activeElement === card) this.pendingFocusCitation = undefined;
	}

	private citedSourceCard(n: number): HTMLElement | null {
		return this.host.nativeElement.querySelector<HTMLElement>(`[data-citation-source="${n}"]`);
	}

	/**
	 * Returns the number of sources available for the current message
	 * @returns number of sources or 0 if no sources available
	 */
	get sourcesCount(): number {
		return this.message?.sources?.length || 0;
	}

	/**
	 * Checks if the message has any sources to display
	 * @returns true if message has one or more sources
	 */
	get hasMultipleSources(): boolean {
		return this.sourcesCount > 0;
	}
}
