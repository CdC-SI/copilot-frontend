import {Component, DestroyRef, inject} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {HttpErrorResponse} from '@angular/common/http';
import {MatDialogRef} from '@angular/material/dialog';
import {ObEUploadEventType, ObIUploadEvent, ObNotificationService} from '@oblique/oblique';
import {filter} from 'rxjs/operators';
import {CatalogService} from '../../shared/services/catalog.service';
import {CatalogImportError, CatalogImportReport, CatalogItemReport} from '../../shared/model/catalog';

export interface CatalogImportDialogResult {
	/** Vrai si au moins un import a été appliqué : la liste appelante doit être rechargée. */
	imported: boolean;
}

@Component({
	selector: 'zco-catalog-import-dialog',
	templateUrl: './catalog-import-dialog.component.html',
	styleUrl: './catalog-import-dialog.component.scss'
})
export class CatalogImportDialogComponent {
	readonly maxFileSizeMb = 1;
	readonly reportSections: {key: keyof CatalogImportReport; label: string}[] = [
		{key: 'sources', label: 'admin.catalog.import.report.sources'},
		{key: 'workspaces', label: 'admin.catalog.import.report.workspaces'}
	];
	readonly reportKinds: {key: keyof CatalogItemReport; label: string}[] = [
		{key: 'created', label: 'admin.catalog.import.report.created'},
		{key: 'updated', label: 'admin.catalog.import.report.updated'},
		{key: 'unchanged', label: 'admin.catalog.import.report.unchanged'}
	];

	file: File | null = null;
	importing = false;
	exporting = false;
	report: CatalogImportReport | null = null;
	errors: string[] = [];
	private imported = false;

	constructor(
		private readonly catalogService: CatalogService,
		private readonly notif: ObNotificationService,
		private readonly ref: MatDialogRef<CatalogImportDialogComponent, CatalogImportDialogResult>
	) {
		// La fermeture (backdrop / Échap) doit toujours renvoyer le résultat pour déclencher le rechargement.
		ref.disableClose = true;
		const destroyRef = inject(DestroyRef);
		ref
			.backdropClick()
			.pipe(takeUntilDestroyed(destroyRef))
			.subscribe(() => this.close());
		ref
			.keydownEvents()
			.pipe(
				filter(event => event.key === 'Escape'),
				takeUntilDestroyed(destroyRef)
			)
			.subscribe(() => this.close());
	}

	onFileChosen(event: ObIUploadEvent): void {
		if (event.type !== ObEUploadEventType.CHOSEN) return;
		const chosen = event.files.find((f): f is File => f instanceof File);
		if (chosen) {
			this.file = chosen;
			this.errors = [];
			this.report = null;
		}
	}

	removeFile(): void {
		this.file = null;
		this.errors = [];
	}

	importFile(): void {
		if (!this.file || this.importing) return;
		this.importing = true;
		this.errors = [];
		this.report = null;
		this.catalogService.import(this.file).subscribe({
			next: report => {
				this.importing = false;
				this.imported = true;
				this.report = report;
				this.file = null;
				this.notif.success('admin.catalog.import.success');
			},
			error: (err: HttpErrorResponse) => {
				this.importing = false;
				this.errors = this.extractErrors(err);
				this.notif.error('admin.catalog.import.error');
			}
		});
	}

	exportCatalog(): void {
		if (this.exporting) return;
		this.exporting = true;
		this.catalogService.export().subscribe({
			next: blob => {
				this.exporting = false;
				const url = globalThis.URL.createObjectURL(blob);
				const link = document.createElement('a');
				link.href = url;
				link.download = 'catalog.yaml';
				link.click();
				globalThis.URL.revokeObjectURL(url);
			},
			error: () => {
				this.exporting = false;
				this.notif.error('admin.catalog.export.error');
			}
		});
	}

	close(): void {
		if (this.importing) return;
		this.ref.close({imported: this.imported});
	}

	private extractErrors(err: HttpErrorResponse): string[] {
		const body = err.error as Partial<CatalogImportError> | null;
		if (err.status === 400 && Array.isArray(body?.messages) && body.messages.length) {
			return body.messages;
		}
		return [];
	}
}
