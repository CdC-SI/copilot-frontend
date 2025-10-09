import {Component, ElementRef, Input, OnChanges, SimpleChanges, ViewChild} from '@angular/core';
import {MessageSource} from '../../model/chat-history';
import {ObNotificationService} from '@oblique/oblique';
import {FeedbackService} from '../../services/feedback.service';
import {AuthenticationServiceV2} from '../../services/auth.service';
import {ChatMessage} from '../../model/chat-message';

type FeedbackVote = 'upvote' | 'downvote';

@Component({
	selector: 'zco-source-list',
	templateUrl: './source-list.component.html',
	styleUrl: './source-list.component.scss'
})
export class SourceListComponent implements OnChanges {
	@Input() message!: ChatMessage;
	@Input() question?: string;
	@Input() conversationId!: string;
	@Input() expanded = false;

	// dialog state
	selectedSource: MessageSource | null = null;
	selectedVote: FeedbackVote | null = null;
	comment = '';
	isSubmitting = false;
	isEditing = false;
	previousVote: FeedbackVote | null = null;

	// vote + optional comment caches
	feedbackById = new Map<string, FeedbackVote>();
	feedbackComments = new Map<string, string>();

	@ViewChild('feedbackDialog') feedbackDialog?: ElementRef<HTMLDialogElement>;
	@ViewChild('commentInput') commentInput?: ElementRef<HTMLTextAreaElement>;

	private feedbackLoaded = false; // avoid redundant calls

	constructor(
		private readonly notifService: ObNotificationService,
		private readonly feedbackService: FeedbackService,
		private readonly authService: AuthenticationServiceV2
	) {}

	ngOnChanges(changes: SimpleChanges): void {
		// When the container expands for the first time, fetch existing feedbacks
		if (changes['expanded'] && this.expanded && !this.feedbackLoaded) {
			this.loadExistingFeedbacks();
		}

		// If sources array changes after we loaded feedback, re-apply mapping to sources
		if (changes['sources'] && this.feedbackLoaded) {
			this.applyFeedbackToSources();
		}
	}

	/** Convenience helpers */
	isUrl(s: MessageSource): boolean {
		return s.type === 'URL';
	}
	extractLabel(link: string): string {
		try {
			const {hostname, pathname} = new URL(link);
			return hostname.replace(/^www\./, '') + pathname;
		} catch (_) {
			return link;
		}
	}
	fileName(path: string): string {
		return path.split('/').pop() ?? path;
	}

	/* ---------------------- Feedback flow ---------------------- */

	openFeedback(source: MessageSource, vote: FeedbackVote): void {
		this.selectedSource = source;
		this.selectedVote = vote;

		const id = source.documentId;
		const existingVote = this.feedbackById.get(id) || null;
		const existingComment = this.feedbackComments.get(id) || '';

		// Editing mode if we already have any feedback on this source
		this.isEditing = !!existingVote || !!existingComment;
		this.previousVote = existingVote;

		// Prefill the comment with the previous one (user can edit)
		this.comment = existingComment;

		const dlg = this.feedbackDialog?.nativeElement;
		if (dlg && !dlg.open) {
			dlg.showModal();
			setTimeout(() => this.commentInput?.nativeElement?.focus(), 0);
		}
	}

	closeFeedback(): void {
		const dlg = this.feedbackDialog?.nativeElement;
		if (dlg?.open) dlg.close();
	}

	onDialogClosed(): void {
		this.selectedSource = null;
		this.selectedVote = null;
		this.comment = '';
		this.isSubmitting = false;
	}

	submitFeedback(ev: Event): void {
		ev.preventDefault();
		if (!this.selectedSource || !this.selectedVote) return;

		const documentId = this.selectedSource.documentId;
		this.isSubmitting = true;

		this.feedbackService
			.sendSourceFeedback({
				conversationId: this.conversationId,
				messageId: this.message.id,
				documentId,
				isPositive: this.selectedVote === 'upvote',
				comment: this.comment?.trim() || undefined,
				question: this.question,
				answer: this.message.message
			})
			.subscribe({
				next: () => {
					// Update local state immediately
					this.feedbackById.set(documentId, this.selectedVote);
					if (this.comment) this.feedbackComments.set(documentId, this.comment);
					this.applyFeedbackToSources();
					this.notifService.success('feedback.success');
					this.closeFeedback();
				},
				error: () => {
					this.notifService.error('feedback.error');
					this.isSubmitting = false;
				}
			});
	}

	authenticatedAsExpert() {
		return this.authService.hasExpertRole();
	}

	/* ---------------------- Existing feedbacks ---------------------- */

	private loadExistingFeedbacks(): void {
		if (!this.authenticatedAsExpert() || !this.conversationId || !this.message.id) return;

		this.feedbackService.getMySourceFeedbacks(this.conversationId, this.message.id).subscribe({
			next: rows => {
				// rows: one per source (for this user)
				for (const r of rows ?? []) {
					if (!r.documentId) continue;
					const vote: FeedbackVote = r.isPositive ? 'upvote' : 'downvote';
					this.feedbackById.set(r.documentId, vote);
					if (r.comment) this.feedbackComments.set(r.documentId, r.comment);
				}
				this.applyFeedbackToSources();
				this.feedbackLoaded = true;
			},
			error: () => {
				// Non-blocking: user can still vote; we just couldn’t pre-fill
				this.notifService.warning('Impossible de récupérer vos feedbacks existants.');
			}
		});
	}

	/** Optionally reflect the vote directly on source objects (e.g., UI badges elsewhere) */
	private applyFeedbackToSources(): void {
		for (const s of this.message.sources) {
			const id = s.documentId;
			// @ts-expect-error — decorate if you want to use elsewhere
			s.userFeedback = this.feedbackById.get(id); // 'upvote' | 'downvote' | undefined
		}
	}
}
