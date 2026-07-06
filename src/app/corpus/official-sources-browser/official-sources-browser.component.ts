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
					this.workspaces = workspaces;
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
}
