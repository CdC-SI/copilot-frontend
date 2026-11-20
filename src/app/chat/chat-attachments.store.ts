import {Injectable, OnDestroy, computed, inject, signal} from '@angular/core';
import {HttpEventType} from '@angular/common/http';
import {ObNotificationService} from '@oblique/oblique';
import {Subscription} from 'rxjs';
import {Attachment, AttachmentDTO, AttachmentStatus, AttachmentUploadResponse, ChatTitle} from '../shared/model/chat-history';
import {ConversationService} from '../shared/services/conversation.service';
import {extractUploadErrorCode, uploadErrorNotification} from '../shared/utils/upload-error.utils';
import {PollTimeoutError, pollUntil} from '../shared/utils/poll-until';

const ATTACHMENT_POLL_INTERVAL_MS = 15_000;
const ATTACHMENT_POLL_MAX_ATTEMPTS = 240;

/**
 * Pièces jointes de la conversation courante : envoi, nouvel essai, suppression, téléchargement et suivi du
 * traitement côté backend (interrogation périodique ; au-delà du nombre maximal de tentatives, rafraîchissement manuel).
 * Les pièces jointes ne sont jamais modifiées en place (fichier local ou `id` serveur pour les retrouver).
 */
@Injectable()
export class ChatAttachmentsStore implements OnDestroy {
	readonly attachments = computed(() => this.items());
	/** Traitement toujours en cours après la dernière tentative : rafraîchissement manuel proposé. */
	readonly pollingTimedOut = computed(() => this.timedOut());
	readonly isUploading = computed(() => this.items().some(attachment => attachment.isUploading));
	private readonly items = signal<Attachment[]>([]);
	private readonly timedOut = signal(false);
	private polling?: Subscription;
	private readonly conversationService = inject(ConversationService);
	private readonly notif = inject(ObNotificationService);

	ngOnDestroy(): void {
		this.stopPolling();
	}

	/** Nouvelle conversation : plus aucune pièce jointe. */
	reset(): void {
		this.stopPolling();
		this.items.set([]);
		this.timedOut.set(false);
	}

	/** Changement de conversation : le suivi s'arrête en attendant les pièces jointes de la conversation choisie. */
	suspend(): void {
		this.stopPolling();
		this.timedOut.set(false);
	}

	load(conversationId: string, attachments: AttachmentDTO[]): void {
		this.items.set(
			attachments.map(attachment => ({
				id: attachment.id,
				fileName: attachment.filename,
				fileSize: attachment.fileSize,
				status: attachment.status,
				errorCode: attachment.errorCode,
				isUploading: attachment.status === 'PENDING'
			}))
		);
		if (this.hasPending()) this.startPolling(conversationId);
	}

	/**
	 * Envoie des fichiers. `resolveConversation` reçoit la conversation à laquelle le backend les a rattachés
	 * (créée si besoin) et renvoie la conversation courante, dont le traitement est ensuite suivi.
	 */
	upload(files: File[], conversation: ChatTitle | null, resolveConversation: (conversationId: string) => string): void {
		const pending: Attachment[] = files.map(file => ({fileName: file.name, fileSize: file.size, file, status: 'PENDING', isUploading: true}));
		this.items.update(items => [...items, ...pending]);
		this.conversationService.uploadAttachments(conversation, ...files).subscribe({
			next: event => {
				if (event.type !== HttpEventType.Response) return;
				// Réponse tardive : les fichiers ne sont plus affichés (changement de conversation), la conversation et le suivi courants sont conservés.
				if (!this.isDisplayed(files)) return;
				const conversationId = resolveConversation(event.body.conversationAttachments.conversationId);
				this.applyUploadResponse(event.body, files);
				this.followProcessing(conversationId, event.body.status);
			},
			error: err => {
				this.items.update(items => items.filter(attachment => !files.includes(attachment.file)));
				this.notif.error(uploadErrorNotification(err, 'attachment.upload.error'));
			}
		});
	}

	retry(attachment: Attachment, conversation: ChatTitle | null): void {
		const file = attachment.file;
		if (!file || !conversation) return;
		this.patchByFile(file, {status: 'PENDING', isUploading: true});
		this.conversationService.uploadAttachments(conversation, file).subscribe({
			next: event => {
				if (event.type !== HttpEventType.Response || !this.isDisplayed([file])) return;
				this.applyUploadResponse(event.body, [file]);
				this.followProcessing(conversation.conversationId, event.body.status);
			},
			error: err => {
				this.patchByFile(file, {status: 'FAILED', errorCode: extractUploadErrorCode(err), isUploading: false});
				this.notif.error(uploadErrorNotification(err, 'attachment.upload.error', attachment.fileName));
			}
		});
	}

	remove(id: number): void {
		this.conversationService.deleteAttachment(id).subscribe(() => {
			this.items.update(items => items.filter(attachment => attachment.id !== id));
			this.notif.success('attachment.delete.success');
		});
	}

	download(attachment: Attachment, conversationId: string | undefined): void {
		if (!attachment.id || attachment.isUploading || !conversationId) return;
		this.conversationService.downloadAttachment(conversationId, attachment.id).subscribe({
			next: blob => {
				const url = globalThis.URL.createObjectURL(blob);
				const link = document.createElement('a');
				link.href = url;
				link.download = attachment.fileName || 'attachment';
				link.click();
				globalThis.URL.revokeObjectURL(url);
			},
			error: () => this.notif.error('attachment.download.error')
		});
	}

	/** Relance manuelle du suivi après l'expiration du délai. */
	refresh(conversationId: string | undefined): void {
		if (!conversationId) return;
		this.startPolling(conversationId);
	}

	private isDisplayed(files: File[]): boolean {
		return this.items().some(attachment => !!attachment.file && files.includes(attachment.file));
	}

	private hasPending(): boolean {
		return this.items().some(attachment => attachment.status === 'PENDING');
	}

	private applyUploadResponse(response: AttachmentUploadResponse, files: File[]): void {
		const serverAttachments = response.conversationAttachments.attachments;
		this.items.update(items =>
			items.map(attachment => {
				const server = files.includes(attachment.file) && serverAttachments.find(s => s.filename === attachment.file.name);
				return server ? {...attachment, id: server.id, ...this.serverStatus(server)} : attachment;
			})
		);
	}

	private followProcessing(conversationId: string, aggregatedStatus: AttachmentStatus): void {
		if (this.hasPending()) {
			this.startPolling(conversationId);
		} else {
			this.notifyProcessed(aggregatedStatus);
		}
	}

	private startPolling(conversationId: string): void {
		this.stopPolling();
		this.timedOut.set(false);
		this.polling = pollUntil(() => this.conversationService.getConversationAttachmentsStatus(conversationId), {
			intervalMs: ATTACHMENT_POLL_INTERVAL_MS,
			maxAttempts: ATTACHMENT_POLL_MAX_ATTEMPTS,
			continueWhile: () => this.hasPending(),
			isDone: () => !this.hasPending()
		}).subscribe({
			next: response => {
				this.applyPolledStatus(response);
				if (!this.hasPending()) this.notifyProcessed(response.status);
			},
			error: err => {
				if (err instanceof PollTimeoutError) {
					this.timedOut.set(true);
					this.notif.warning('attachment.process.timeout');
				}
			}
		});
	}

	private stopPolling(): void {
		this.polling?.unsubscribe();
		this.polling = undefined;
	}

	private applyPolledStatus(response: AttachmentUploadResponse): void {
		const serverAttachments = response.conversationAttachments.attachments;
		this.items.update(items =>
			items.map(attachment => {
				const server = serverAttachments.find(s => s.id === attachment.id);
				return server ? {...attachment, ...this.serverStatus(server)} : attachment;
			})
		);
	}

	private serverStatus(server: AttachmentDTO): Partial<Attachment> {
		return {status: server.status, errorCode: server.errorCode, isUploading: server.status === 'PENDING'};
	}

	private patchByFile(file: File, changes: Partial<Attachment>): void {
		this.items.update(items => items.map(attachment => (attachment.file === file ? {...attachment, ...changes} : attachment)));
	}

	private notifyProcessed(aggregatedStatus: AttachmentStatus): void {
		if (aggregatedStatus === 'PROCESSED') {
			this.notif.success('attachment.process.success');
		} else if (aggregatedStatus === 'FAILED') {
			this.notif.error('attachment.process.error');
		}
	}
}
