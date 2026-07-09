import {Component, EventEmitter, Input, Output} from '@angular/core';
import {MatDialog} from '@angular/material/dialog';
import {ObNotificationService} from '@oblique/oblique';
import {WorkspaceDto} from '../../model/workspace';
import {WorkspaceService} from '../../services/workspace.service';
import {WorkspaceContentDialogComponent} from '../workspace-content-dialog/workspace-content-dialog.component';

/**
 * Petit badge affiché sous une question pour indiquer le workspace (corpus documentaire) utilisé
 * par le backend pour y répondre. Permet de consulter le contenu du workspace, ou d'en choisir un
 * autre pour reposer la même question avec ce workspace explicitement imposé.
 */
@Component({
	selector: 'zco-workspace-badge',
	templateUrl: './workspace-badge.component.html',
	styleUrl: './workspace-badge.component.scss'
})
export class WorkspaceBadgeComponent {
	@Input() workspaceName: string;
	@Input() question: string;
	@Output() readonly workspaceChange = new EventEmitter<{question: string; workspace: string}>();

	availableWorkspaces: WorkspaceDto[] = [];
	isLoadingWorkspaces = false;
	private workspacesLoaded = false;

	constructor(
		private readonly workspaceService: WorkspaceService,
		private readonly dialog: MatDialog,
		private readonly notif: ObNotificationService
	) {}

	openContent(): void {
		this.dialog.open(WorkspaceContentDialogComponent, {
			width: '640px',
			maxWidth: '90vw',
			data: {workspaceName: this.workspaceName}
		});
	}

	/** Charge la liste des workspaces disponibles à la première ouverture du menu, puis la met en cache. */
	loadAvailableWorkspaces(): void {
		if (this.workspacesLoaded || this.isLoadingWorkspaces) return;
		this.isLoadingWorkspaces = true;
		this.workspaceService.getAll().subscribe({
			next: workspaces => {
				this.availableWorkspaces = workspaces;
				this.workspacesLoaded = true;
				this.isLoadingWorkspaces = false;
			},
			error: () => {
				this.isLoadingWorkspaces = false;
				this.notif.error('corpus.workspaces.load.error');
			}
		});
	}

	selectWorkspace(workspace: WorkspaceDto): void {
		if (!this.question || workspace.name === this.workspaceName) return;
		this.workspaceChange.emit({question: this.question, workspace: workspace.name});
	}

	isCurrent(workspace: WorkspaceDto): boolean {
		return workspace.name === this.workspaceName;
	}
}
