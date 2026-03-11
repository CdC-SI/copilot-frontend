import {Component, OnDestroy, OnInit} from '@angular/core';
import {Observable, Subject, forkJoin, timer} from 'rxjs';
import {finalize, switchMap, takeUntil, takeWhile} from 'rxjs/operators';
import {ObEUploadEventType, ObIUploadEvent, ObNotificationService} from '@oblique/oblique';
import {MatDialog} from '@angular/material/dialog';
import {IDocument} from '../shared/model/document';
import {IPersonalDocument} from '../shared/model/personal-document';
import {ISourceRequest, SourceRequestStatus} from '../shared/model/source-request';
import {UploadService} from '../shared/services/upload.service';
import {SettingsService} from '../shared/services/settings.service';
import {SourceRequestService} from '../shared/services/source-request.service';
import {SettingsType} from '../shared/model/settings';
import {RequestSourceDialogComponent} from './request-source-dialog/request-source-dialog.component';

const BYTES_TO_KB = 1024;
const AUTO_REFRESH_INTERVAL_MS = 30_000;

@Component({
	selector: 'zco-personal-documents',
	templateUrl: './personal-documents.component.html',
	styleUrl: './personal-documents.component.scss'
})
export class PersonalDocumentsComponent implements OnInit, OnDestroy {
	documentsToUpload: IDocument[] = [];
	userDocuments: IPersonalDocument[] = [];
	officialSources: string[] = [];
	sourceRequests: ISourceRequest[] = [];

	isUploading = false;
	isLoadingDocuments = false;
	isLoadingSources = false;
	isLoadingRequests = false;
	showUploadInfo = false;

	readonly SourceRequestStatus = SourceRequestStatus;

	private readonly destroy$ = new Subject<void>();

	constructor(
		private readonly uploadService: UploadService,
		private readonly notifService: ObNotificationService,
		private readonly settingsService: SettingsService,
		private readonly sourceRequestService: SourceRequestService,
		private readonly dialog: MatDialog
	) {}

	ngOnInit(): void {
		this.loadUserDocuments();
		this.loadOfficialSources();
		this.loadMySourceRequests();
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
					this.notifService.success('personal.documents.delete.success');
					this.loadUserDocuments();
				},
				error: () => this.notifService.error('personal.documents.delete.error')
			});
	}

	loadOfficialSources(): void {
		this.isLoadingSources = true;
		this.settingsService
			.getSettings(SettingsType.SOURCE)
			.pipe(
				takeUntil(this.destroy$),
				finalize(() => (this.isLoadingSources = false))
			)
			.subscribe({
				next: (sources: string[]) => (this.officialSources = sources),
				error: () => this.notifService.error('sources.load.error')
			});
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

	private createUploadRequests(): Observable<void>[] {
		return this.documentsToUpload.filter((doc): doc is IDocument & {file: File} => !!doc.file).map(doc => this.uploadService.uploadPersonalPdf(doc.file));
	}

	private executeUploads(uploadRequests: Observable<void>[]): void {
		this.isUploading = true;

		forkJoin(uploadRequests)
			.pipe(
				takeUntil(this.destroy$),
				finalize(() => (this.isUploading = false))
			)
			.subscribe({
				next: () => this.handleUploadSuccess(),
				error: () => this.handleUploadError()
			});
	}

	private handleUploadSuccess(): void {
		this.notifService.success('personal.documents.upload.success');
		this.documentsToUpload = [];
		this.showUploadInfo = true;
		this.loadUserDocuments();
		this.startAutoRefresh();
	}

	private handleUploadError(): void {
		this.notifService.error('personal.documents.upload.error');
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
		timer(AUTO_REFRESH_INTERVAL_MS, AUTO_REFRESH_INTERVAL_MS)
			.pipe(
				takeUntil(this.destroy$),
				takeWhile(() => this.hasPendingDocuments()),
				switchMap(() => this.uploadService.getUserDocuments())
			)
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
