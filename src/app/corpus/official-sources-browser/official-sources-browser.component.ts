import {Component, OnDestroy, OnInit} from '@angular/core';
import {Subject, forkJoin} from 'rxjs';
import {finalize, takeUntil} from 'rxjs/operators';
import {ObNotificationService} from '@oblique/oblique';
import {SourceDto} from '../../shared/model/source';
import {WorkspaceDto} from '../../shared/model/workspace';
import {SourceService} from '../../shared/services/source.service';
import {WorkspaceService} from '../../shared/services/workspace.service';

@Component({
	selector: 'zco-official-sources-browser',
	templateUrl: './official-sources-browser.component.html',
	styleUrl: './official-sources-browser.component.scss'
})
export class OfficialSourcesBrowserComponent implements OnInit, OnDestroy {
	workspaces: WorkspaceDto[] = [];
	otherSources: SourceDto[] = [];

	isLoading = false;

	/** Nom technique (non traduit) du workspace spécial qui représente "toutes les sources". */
	private static readonly GENERAL_WORKSPACE_NAME = 'GENERAL';

	private sourcesByName = new Map<string, SourceDto>();
	private readonly contentsCache = new Map<string, SourceDto>();
	private readonly loadingContentFor = new Set<string>();
	private readonly destroy$ = new Subject<void>();

	constructor(
		private readonly workspaceService: WorkspaceService,
		private readonly sourceService: SourceService,
		private readonly notif: ObNotificationService
	) {}

	ngOnInit(): void {
		this.load();
	}

	ngOnDestroy(): void {
		this.destroy$.next();
		this.destroy$.complete();
	}

	load(): void {
		this.isLoading = true;
		forkJoin({
			workspaces: this.workspaceService.getAll(),
			sources: this.sourceService.getAll()
		})
			.pipe(
				takeUntil(this.destroy$),
				finalize(() => (this.isLoading = false))
			)
			.subscribe({
				next: ({workspaces, sources}) => {
					this.workspaces = this.sortWithGeneralFirst(workspaces);
					this.sourcesByName = new Map(sources.map(source => [source.name, source]));
					this.otherSources = this.computeOrphanSources(workspaces, sources);
				},
				error: () => this.notif.error('corpus.workspaces.load.error')
			});
	}

	/** Résout le nom d'une source d'un workspace vers son DTO complet (description, questions). */
	resolveSource(name: string): SourceDto | undefined {
		return this.sourcesByName.get(name);
	}

	/**
	 * Le workspace "Général" ne référence aucune source explicitement : c'est le workspace implicite
	 * utilisé quand aucun thème particulier ne correspond, il contient donc de facto toutes les sources.
	 */
	isGeneralWorkspace(workspace: WorkspaceDto): boolean {
		return workspace.name === OfficialSourcesBrowserComponent.GENERAL_WORKSPACE_NAME;
	}

	/** Sources affichées pour un workspace : pour "Général", ce sont toutes les sources non rattachées à un autre workspace. */
	getWorkspaceSourceNames(workspace: WorkspaceDto): string[] {
		if (!this.isGeneralWorkspace(workspace)) {
			return workspace.sources;
		}
		return Array.from(new Set([...workspace.sources, ...this.otherSources.map(source => source.name)]));
	}

	/** Charge le détail (contenus) d'une source à la volée, une seule fois, en la mémorisant dans un cache. */
	loadSourceContents(name: string): void {
		if (this.contentsCache.has(name) || this.loadingContentFor.has(name)) {
			return;
		}
		this.loadingContentFor.add(name);
		this.sourceService
			.getByName(name)
			.pipe(
				takeUntil(this.destroy$),
				finalize(() => this.loadingContentFor.delete(name))
			)
			.subscribe({
				next: detail => this.contentsCache.set(name, detail),
				error: () => this.notif.error('corpus.workspaces.load.error')
			});
	}

	getContents(name: string): SourceDto | undefined {
		return this.contentsCache.get(name);
	}

	isLoadingContents(name: string): boolean {
		return this.loadingContentFor.has(name);
	}

	private computeOrphanSources(workspaces: WorkspaceDto[], sources: SourceDto[]): SourceDto[] {
		const namesInWorkspaces = new Set(workspaces.flatMap(workspace => workspace.sources));
		return sources.filter(source => !namesInWorkspaces.has(source.name));
	}

	/** Le workspace "Général" est mis en avant en tête de liste, car il agit comme fourre-tout par défaut. */
	private sortWithGeneralFirst(workspaces: WorkspaceDto[]): WorkspaceDto[] {
		return [...workspaces].sort((a, b) => Number(this.isGeneralWorkspace(b)) - Number(this.isGeneralWorkspace(a)));
	}
}
