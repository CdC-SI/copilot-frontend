import {Component, OnDestroy, OnInit} from '@angular/core';
import {Observable, Subject, forkJoin} from 'rxjs';
import {finalize, takeUntil} from 'rxjs/operators';
import {ObEUploadEventType, ObIUploadEvent, ObNotificationService} from '@oblique/oblique';
import {IDocument} from '../shared/model/document';
import {IPersonalDocument} from '../shared/model/personal-document';
import {UploadService} from '../shared/services/upload.service';

const BYTES_TO_KB = 1024;

@Component({
	selector: 'zco-personal-documents',
	templateUrl: './personal-documents.component.html',
	styleUrl: './personal-documents.component.scss'
})
export class PersonalDocumentsComponent implements OnInit, OnDestroy {
	documentsToUpload: IDocument[] = [];
	userDocuments: IPersonalDocument[] = [];
	isUploading = false;
	isLoadingDocuments = false;

	private readonly destroy$ = new Subject<void>();

	constructor(
		private readonly uploadService: UploadService,
		private readonly notifService: ObNotificationService
	) {}

	ngOnInit(): void {
		this.loadUserDocuments();
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
		this.loadUserDocuments();
	}

	private handleUploadError(): void {
		this.notifService.error('personal.documents.upload.error');
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

	private saveFile(blob: Blob, filename: string): void {
		const url = window.URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = filename;
		link.click();
		window.URL.revokeObjectURL(url);
	}
}
