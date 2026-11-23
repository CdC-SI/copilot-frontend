import {ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject} from '@angular/core';
import {Observable, Subject, Subscription, forkJoin, of} from 'rxjs';
import {catchError, finalize, map, takeUntil} from 'rxjs/operators';
import {ObButtonDirective, ObEUploadEventType, ObFileUploadComponent, ObIUploadEvent, ObIconButtonDirective, ObNotificationService} from '@oblique/oblique';
import {MatDialog} from '@angular/material/dialog';
import {IDocument} from '../shared/model/document';
import {IPersonalDocument} from '../shared/model/personal-document';
import {ISourceRequest, SourceRequestStatus} from '../shared/model/source-request';
import {UploadService} from '../shared/services/upload.service';
import {SourceRequestService} from '../shared/services/source-request.service';
import {RequestSourceDialogComponent} from './request-source-dialog/request-source-dialog.component';
import {AuthenticationServiceV2} from '../shared/services/auth.service';
import {UserStatus} from '../shared/model/user';
import {uploadErrorKey, uploadErrorNotification} from '../shared/utils/upload-error.utils';
import {pollUntil} from '../shared/utils/poll-until';
import {MatTab, MatTabGroup} from '@angular/material/tabs';
import {MatIcon} from '@angular/material/icon';
import {MatButton, MatIconButton} from '@angular/material/button';
import {MatProgressSpinner} from '@angular/material/progress-spinner';
import {MatCard, MatCardActions, MatCardAvatar, MatCardContent, MatCardHeader, MatCardSubtitle, MatCardTitle} from '@angular/material/card';
import {MatChip} from '@angular/material/chips';
import {MatTooltip} from '@angular/material/tooltip';
import {OfficialSourcesBrowserComponent} from './official-sources-browser/official-sources-browser.component';
import {DatePipe} from '@angular/common';
import {TranslatePipe} from '@ngx-translate/core';
import {SourceViewerStore} from '../shared/components/source-viewer/source-viewer.store';
import {SourceViewerPanelComponent} from '../shared/components/source-viewer/source-viewer-panel.component';

const BYTES_TO_KB = 1024;
const AUTO_REFRESH_INTERVAL_MS = 30_000;

interface UploadResult {
	doc: IDocument;
	error?: unknown;
}

@Component({
	selector: 'zco-corpus',
	templateUrl: './corpus.component.html',
	styleUrl: './corpus.component.scss',
	changeDetection: ChangeDetectionStrategy.Eager,
	providers: [SourceViewerStore],
	imports: [
		MatTabGroup,
		MatTab,
		ObFileUploadComponent,
		MatIcon,
		MatIconButton,
		ObIconButtonDirective,
		ObButtonDirective,
		MatButton,
		MatProgressSpinner,
		MatCard,
		MatCardHeader,
		MatCardAvatar,
		MatCardTitle,
		MatCardSubtitle,
		MatChip,
		MatCardContent,
		MatCardActions,
		MatTooltip,
		OfficialSourcesBrowserComponent,
		SourceViewerPanelComponent,
		DatePipe,
		TranslatePipe
	]
})
export class CorpusComponent implements OnInit, OnDestroy {
	documentsToUpload: IDocument[] = [];
	userDocuments: IPersonalDocument[] = [];
	sourceRequests: ISourceRequest[] = [];

	isUploading = false;
	isLoadingDocuments = false;
	isLoadingRequests = false;
	showUploadInfo = false;

	readonly SourceRequestStatus = SourceRequestStatus;
	protected readonly viewer = inject(SourceViewerStore);

	private readonly destroy$ = new Subject<void>();
	private autoRefresh?: Subscription;
	private readonly uploadService = inject(UploadService);
	private readonly notifService = inject(ObNotificationService);
	private readonly sourceRequestService = inject(SourceRequestService);
	private readonly dialog = inject(MatDialog);
	private readonly authService = inject(AuthenticationServiceV2);

	ngOnInit(): void {
		/*
		 * Wait for the JWT/authenticated user to be ready before firing authenticated requests,
		 * consistent with ChatComponent. Protects against requests racing ahead of the token
		 * (e.g. on page refresh before APP_INITIALIZER auth flow resolves).
		 */
		this.authService.$authenticatedUser.pipe(takeUntil(this.destroy$)).subscribe(user => {
			if (user?.status === UserStatus.ACTIVE) {
				this.loadUserDocuments();
				this.loadMySourceRequests();
			}
		});
	}

	ngOnDestroy(): void {
		this.destroy$.next();
		this.destroy$.complete();
	}

	uploadPersonalDocument(event: ObIUploadEvent): void {
		if (this.isChosenEvent(event)) {
			this.addFilesToQueue(event.files);
		}
	}

	removeDocument(doc: IDocument): void {
		const index = this.documentsToUpload.indexOf(doc);
		if (index > -1) {
			this.documentsToUpload.splice(index, 1);
		}
	}

	uploadDocuments(): void {
		if (this.hasNoDocuments()) {
			return;
		}

		const uploadRequests = this.createUploadRequests();
		this.executeUploads(uploadRequests);
	}

	getFileSizeInKB(fileSize: number | undefined): number {
		return fileSize ? Math.round(fileSize / BYTES_TO_KB) : 0;
	}

	loadUserDocuments(): void {
		this.isLoadingDocuments = true;
		this.uploadService
			.getUserDocuments()
			.pipe(
				takeUntil(this.destroy$),
				finalize(() => (this.isLoadingDocuments = false))
			)
			.subscribe({
				next: (docs: IPersonalDocument[]) => (this.userDocuments = docs),
				error: () => this.notifService.error('personal.documents.load.error')
			});
	}

	/** Les PDF personnels s'ouvrent dans le panneau des sources (visionneuse) ; les autres formats se téléchargent. */
	canOpenDocument(doc: IPersonalDocument): boolean {
		return doc.title.toLowerCase().endsWith('.pdf');
	}

	openDocument(doc: IPersonalDocument): void {
		this.viewer.openFile(doc.title, () => this.uploadService.downloadSourceDocument(doc.title));
	}

	downloadDocument(doc: IPersonalDocument): void {
		this.uploadService
			.downloadSourceDocument(doc.title)
			.pipe(takeUntil(this.destroy$))
			.subscribe({
				next: blob => this.saveFile(blob, doc.title),
				error: () => this.notifService.error('personal.documents.download.error')
			});
	}

	deleteDocument(doc: IPersonalDocument): void {
		this.uploadService
			.deleteUserDocument(doc.title)
			.pipe(takeUntil(this.destroy$))
			.subscribe({
				next: () => {
					this.closeViewerOn(doc);
					this.notifService.success('personal.documents.delete.success');
					this.loadUserDocuments();
				},
				error: () => this.notifService.error('personal.documents.delete.error')
			});
	}

	reactivateDocument(doc: IPersonalDocument): void {
		this.uploadService
			.reactivateUserDocument(doc.title)
			.pipe(takeUntil(this.destroy$))
			.subscribe({
				next: () => {
					this.notifService.success('personal.documents.reactivate.success');
					this.loadUserDocuments();
				},
				error: () => this.notifService.error('personal.documents.reactivate.error')
			});
	}

	isArchived(doc: IPersonalDocument): boolean {
		return doc.availabilityStatus === 'ARCHIVED';
	}

	getAvailabilityStatusClass(doc: IPersonalDocument): string {
		return this.isArchived(doc) ? 'availability-archived' : 'availability-active';
	}

	loadMySourceRequests(): void {
		this.isLoadingRequests = true;
		this.sourceRequestService
			.getMyRequests()
			.pipe(
				takeUntil(this.destroy$),
				finalize(() => (this.isLoadingRequests = false))
			)
			.subscribe({
				next: (requests: ISourceRequest[]) => (this.sourceRequests = requests),
				error: () => this.notifService.error('sources.requests.load.error')
			});
	}

	openRequestSourceDialog(): void {
		this.dialog
			.open(RequestSourceDialogComponent, {width: '600px'})
			.afterClosed()
			.subscribe(result => {
				if (result) {
					this.createSourceRequest(result);
				}
			});
	}

	deleteSourceRequest(request: ISourceRequest): void {
		if (!request.id) return;

		this.sourceRequestService
			.deleteRequest(request.id)
			.pipe(takeUntil(this.destroy$))
			.subscribe({
				next: () => {
					this.notifService.success('sources.request.delete.success');
					this.loadMySourceRequests();
				},
				error: () => this.notifService.error('sources.request.delete.error')
			});
	}

	getStatusColor(status: SourceRequestStatus): string {
		switch (status) {
			case SourceRequestStatus.WAITING:
				return 'accent';
			case SourceRequestStatus.PROCESSING:
				return 'primary';
			case SourceRequestStatus.INTEGRATED:
				return 'success';
			default:
				return 'default';
		}
	}

	getDocumentStatusClass(status: string | undefined): string {
		switch (status) {
			case 'PENDING':
				return 'status-pending';
			case 'PROCESSED':
				return 'status-processed';
			case 'FAILED':
				return 'status-failed';
			default:
				return 'status-pending';
		}
	}

	isDocumentReady(doc: IPersonalDocument): boolean {
		return doc.status === 'PROCESSED';
	}

	/** Clé de traduction de la cause d'échec du traitement, si le document est en échec. */
	getDocumentErrorKey(doc: IPersonalDocument): string | undefined {
		return doc.status === 'FAILED' && doc.errorCode ? uploadErrorKey(doc.errorCode) : undefined;
	}

	hasPendingDocuments(): boolean {
		return this.userDocuments.some(doc => doc.status === 'PENDING');
	}

	private isChosenEvent(event: ObIUploadEvent): boolean {
		return event.type === ObEUploadEventType.CHOSEN;
	}

	private addFilesToQueue(files: (string | File)[]): void {
		files.forEach(file => {
			if (file instanceof File) {
				this.documentsToUpload.push({
					file,
					fileName: file.name,
					fileSize: file.size
				});
			}
		});
	}

	private hasNoDocuments(): boolean {
		return this.documentsToUpload.length === 0;
	}

	private createUploadRequests(): Observable<UploadResult>[] {
		return this.documentsToUpload
			.filter((doc): doc is IDocument & {file: File} => !!doc.file)
			.map(doc =>
				this.uploadService.uploadPersonalPdf(doc.file).pipe(
					map((): UploadResult => ({doc})),
					catchError(error => of<UploadResult>({doc, error}))
				)
			);
	}

	/**
	 * Chaque upload est traité indépendamment : un fichier refusé n'interrompt pas les autres,
	 * et l'utilisateur est informé de la raison de chaque échec.
	 */
	private executeUploads(uploadRequests: Observable<UploadResult>[]): void {
		this.isUploading = true;

		forkJoin(uploadRequests)
			.pipe(
				takeUntil(this.destroy$),
				finalize(() => (this.isUploading = false))
			)
			.subscribe(results => {
				const failed = results.filter(result => result.error);
				failed.forEach(result => this.handleUploadError(result));
				if (failed.length < results.length) {
					this.handleUploadSuccess(failed.map(result => result.doc));
				}
			});
	}

	private handleUploadSuccess(remainingDocuments: IDocument[]): void {
		this.notifService.success('personal.documents.upload.success');
		this.documentsToUpload = remainingDocuments;
		this.showUploadInfo = true;
		this.loadUserDocuments();
		this.startAutoRefresh();
	}

	private handleUploadError(result: UploadResult): void {
		this.notifService.error(uploadErrorNotification(result.error, 'personal.documents.upload.error', result.doc.fileName));
	}

	/** Ferme le panneau s'il affiche le document (supprimé). */
	private closeViewerOn(doc: IPersonalDocument): void {
		const target = this.viewer.target();
		if (target?.kind === 'file' && target.title === doc.title) this.viewer.close();
	}

	private saveFile(blob: Blob, filename: string): void {
		const url = globalThis.URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = filename;
		link.click();
		globalThis.URL.revokeObjectURL(url);
	}

	private createSourceRequest(request: ISourceRequest): void {
		this.sourceRequestService
			.createRequest(request)
			.pipe(takeUntil(this.destroy$))
			.subscribe({
				next: () => {
					this.notifService.success('sources.request.create.success');
					this.loadMySourceRequests();
				},
				error: () => this.notifService.error('sources.request.create.error')
			});
	}

	private startAutoRefresh(): void {
		this.autoRefresh?.unsubscribe();
		this.autoRefresh = pollUntil(() => this.uploadService.getUserDocuments(), {
			intervalMs: AUTO_REFRESH_INTERVAL_MS,
			initialDelayMs: AUTO_REFRESH_INTERVAL_MS,
			continueWhile: () => this.hasPendingDocuments(),
			isDone: docs => !docs.some(doc => doc.status === 'PENDING')
		})
			.pipe(takeUntil(this.destroy$))
			.subscribe({
				next: (docs: IPersonalDocument[]) => {
					this.userDocuments = docs;
					if (!this.hasPendingDocuments()) {
						this.showUploadInfo = false;
					}
				}
			});
	}
}
