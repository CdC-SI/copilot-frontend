import {Component, EventEmitter, OnInit, Output} from '@angular/core';
import {MatTableDataSource} from '@angular/material/table';
import {MatDialog} from '@angular/material/dialog';
import {ObNotificationService} from '@oblique/oblique';
import {CreateWorkspaceRequest, UpdateWorkspaceRequest, WorkspaceDto} from '../../shared/model/workspace';
import {WorkspaceService} from '../../shared/services/workspace.service';
import {WorkspaceEditDialogComponent, WorkspaceEditDialogResult} from './workspace-edit-dialog/workspace-edit-dialog.component';
import {ConfirmDialogComponent} from '../../shared/components/confirm-dialog/confirm-dialog.component';

@Component({
	selector: 'zco-workspaces',
	templateUrl: './workspaces.component.html',
	styleUrl: './workspaces.component.scss'
})
export class WorkspacesComponent implements OnInit {
	displayedColumns: string[] = ['name', 'description', 'sources', 'updatedAt', 'actions'];
	workspacesDataSource = new MatTableDataSource<WorkspaceDto>();
	expandedWorkspace: WorkspaceDto | null = null;

	/** Émis quand l'utilisateur clique sur une source dans le détail d'un workspace, pour la mettre en évidence dans l'onglet Sources. */
	@Output() readonly sourceSelected = new EventEmitter<string>();

	constructor(
		private readonly workspaceService: WorkspaceService,
		private readonly dialog: MatDialog,
		private readonly notif: ObNotificationService
	) {}

	ngOnInit(): void {
		this.reload();
	}

	reload(): void {
		this.workspaceService.getAll().subscribe({
			next: workspaces => (this.workspacesDataSource.data = workspaces),
			error: () => this.notif.error('admin.workspaces.load.error')
		});
	}

	toggleExpand(workspace: WorkspaceDto): void {
		this.expandedWorkspace = this.expandedWorkspace === workspace ? null : workspace;
	}

	isExpanded(workspace: WorkspaceDto): boolean {
		return this.expandedWorkspace === workspace;
	}

	selectSource(name: string): void {
		this.sourceSelected.emit(name);
	}

	openCreateDialog(): void {
		this.openDialog();
	}

	openEditDialog(workspace: WorkspaceDto): void {
		this.openDialog(workspace);
	}

	delete(workspace: WorkspaceDto): void {
		this.dialog
			.open(ConfirmDialogComponent, {
				width: '400px',
				data: {title: 'admin.workspaces.delete.confirm.title', content: 'admin.workspaces.delete.confirm.content', type: 'warning'}
			})
			.afterClosed()
			.subscribe((confirmed: boolean) => {
				if (!confirmed) return;
				this.workspaceService.delete(workspace.name).subscribe({
					next: () => {
						this.notif.success('admin.workspaces.delete.success');
						this.reload();
					},
					error: () => this.notif.error('admin.workspaces.delete.error')
				});
			});
	}

	private openDialog(workspace?: WorkspaceDto): void {
		this.dialog
			.open(WorkspaceEditDialogComponent, {width: '500px', data: {workspace}})
			.afterClosed()
			.subscribe((result: WorkspaceEditDialogResult | undefined) => {
				if (!result) return;
				const call$ = result.isEdit
					? this.workspaceService.update(result.name, result.request as UpdateWorkspaceRequest)
					: this.workspaceService.create(result.request as CreateWorkspaceRequest);
				call$.subscribe({
					next: () => {
						this.notif.success(result.isEdit ? 'admin.workspaces.update.success' : 'admin.workspaces.create.success');
						this.reload();
					},
					error: () => this.notif.error(result.isEdit ? 'admin.workspaces.update.error' : 'admin.workspaces.create.error')
				});
			});
	}
}
