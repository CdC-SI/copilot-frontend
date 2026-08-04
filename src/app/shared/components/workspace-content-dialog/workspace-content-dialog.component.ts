import {Component, Inject, OnInit} from '@angular/core';
import {MAT_DIALOG_DATA} from '@angular/material/dialog';
import {ObNotificationService} from '@oblique/oblique';
import {WorkspaceDto} from '../../model/workspace';
import {SourceDto} from '../../model/source';
import {WorkspaceService} from '../../services/workspace.service';
import {SourceService} from '../../services/source.service';

export interface WorkspaceContentDialogData {
	workspaceName: string;
}

/**
 * Dialogue en lecture seule présentant le contenu d'un workspace (description + sources), dans le
 * même esprit que le composant Corpus (zco-official-sources-browser), afin qu'un utilisateur puisse
 * comprendre pourquoi l'assistant a routé sa question vers ce workspace.
 */
@Component({
	selector: 'zco-workspace-content-dialog',
	templateUrl: './workspace-content-dialog.component.html',
	styleUrl: './workspace-content-dialog.component.scss'
})
export class WorkspaceContentDialogComponent implements OnInit {
	workspace: WorkspaceDto | null = null;
	isLoading = false;

	private readonly contentsCache = new Map<string, SourceDto>();
	private readonly loadingContentFor = new Set<string>();

	constructor(
		@Inject(MAT_DIALOG_DATA) public data: WorkspaceContentDialogData,
		private readonly workspaceService: WorkspaceService,
		private readonly sourceService: SourceService,
		private readonly notif: ObNotificationService
	) {}

	ngOnInit(): void {
		this.isLoading = true;
		this.workspaceService.getByName(this.data.workspaceName).subscribe({
			next: workspace => {
				this.workspace = workspace;
				this.isLoading = false;
			},
			error: () => {
				this.isLoading = false;
				this.notif.error('corpus.workspaces.load.error');
			}
		});
	}

	loadSourceContents(name: string): void {
		if (this.contentsCache.has(name) || this.loadingContentFor.has(name)) {
			return;
		}
		this.loadingContentFor.add(name);
		this.sourceService.getByName(name).subscribe({
			next: detail => {
				this.contentsCache.set(name, detail);
				this.loadingContentFor.delete(name);
			},
			error: () => {
				this.loadingContentFor.delete(name);
				this.notif.error('corpus.workspaces.load.error');
			}
		});
	}

	getContents(name: string): SourceDto | undefined {
		return this.contentsCache.get(name);
	}

	isLoadingContents(name: string): boolean {
		return this.loadingContentFor.has(name);
	}
}
