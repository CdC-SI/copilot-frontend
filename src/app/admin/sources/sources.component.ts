import {Component, OnInit} from '@angular/core';
import {MatTableDataSource} from '@angular/material/table';
import {MatDialog} from '@angular/material/dialog';
import {ObNotificationService} from '@oblique/oblique';
import {CreateSourceRequest, SourceDto, UpdateSourceRequest} from '../../shared/model/source';
import {SourceService} from '../../shared/services/source.service';
import {SourceEditDialogComponent, SourceEditDialogResult} from './source-edit-dialog/source-edit-dialog.component';
import {ConfirmDialogComponent} from '../../shared/components/confirm-dialog/confirm-dialog.component';

@Component({
	selector: 'zco-sources',
	templateUrl: './sources.component.html',
	styleUrl: './sources.component.scss'
})
export class SourcesComponent implements OnInit {
	displayedColumns: string[] = ['name', 'description', 'contents', 'updatedAt', 'actions'];
	sourcesDataSource = new MatTableDataSource<SourceDto>();
	expandedSourceName: string | null = null;
	expandedSourceDetail: SourceDto | null = null;
	loadingDetail = false;

	constructor(
		private readonly sourceService: SourceService,
		private readonly dialog: MatDialog,
		private readonly notif: ObNotificationService
	) {}

	ngOnInit(): void {
		this.reload();
	}

	reload(): void {
		this.sourceService.getAll().subscribe({
			next: sources => (this.sourcesDataSource.data = sources),
			error: () => this.notif.error('admin.sources.load.error')
		});
	}

	toggleExpand(source: SourceDto): void {
		if (this.expandedSourceName === source.name) {
			this.expandedSourceName = null;
			this.expandedSourceDetail = null;
			return;
		}
		this.expandSourceByName(source.name);
	}

	/** Étend une source par son nom et charge son détail complet (contenus) via GET /api/sources/{name}. */
	expandSourceByName(name: string): void {
		this.expandedSourceName = name;
		this.expandedSourceDetail = null;
		this.loadingDetail = true;
		this.sourceService.getByName(name).subscribe({
			next: detail => {
				this.expandedSourceDetail = detail;
				this.loadingDetail = false;
				this.scrollToRow(name);
			},
			error: () => {
				this.loadingDetail = false;
				this.notif.error('admin.sources.load.error');
			}
		});
	}

	isExpanded(source: SourceDto): boolean {
		return this.expandedSourceName === source.name;
	}

	openCreateDialog(): void {
		this.openDialog();
	}

	openEditDialog(source: SourceDto): void {
		this.openDialog(source);
	}

	delete(source: SourceDto): void {
		this.dialog
			.open(ConfirmDialogComponent, {
				width: '400px',
				data: {title: 'admin.sources.delete.confirm.title', content: 'admin.sources.delete.confirm.content', type: 'warning'}
			})
			.afterClosed()
			.subscribe((confirmed: boolean) => {
				if (!confirmed) return;
				this.sourceService.delete(source.name).subscribe({
					next: () => {
						this.notif.success('admin.sources.delete.success');
						this.reload();
					},
					error: () => this.notif.error('admin.sources.delete.error')
				});
			});
	}

	private scrollToRow(name: string): void {
		queueMicrotask(() => {
			document.getElementById(`source-row-${name}`)?.scrollIntoView({behavior: 'smooth', block: 'center'});
		});
	}

	private openDialog(source?: SourceDto): void {
		this.dialog
			.open(SourceEditDialogComponent, {width: '500px', data: {source}})
			.afterClosed()
			.subscribe((result: SourceEditDialogResult | undefined) => {
				if (!result) return;
				const call$ = result.isEdit
					? this.sourceService.update(result.name, result.request as UpdateSourceRequest)
					: this.sourceService.create(result.request as CreateSourceRequest);
				call$.subscribe({
					next: () => {
						this.notif.success(result.isEdit ? 'admin.sources.update.success' : 'admin.sources.create.success');
						this.reload();
					},
					error: () => this.notif.error(result.isEdit ? 'admin.sources.update.error' : 'admin.sources.create.error')
				});
			});
	}
}
