import {Component, OnInit, ViewChild} from '@angular/core';
import {FormBuilder, FormGroup, FormGroupDirective, Validators} from '@angular/forms';
import {ObNotificationService} from '@oblique/oblique';
import {SummaryService} from '../../shared/services/summary.service';
import {SummaryDetailResponse, SummaryTaskResponse, SummaryTaskStatus} from '../../shared/model/summary';

@Component({
	selector: 'zco-career-summary',
	templateUrl: './career-summary.component.html',
	styleUrl: './career-summary.component.scss'
})
export class CareerSummaryComponent implements OnInit {
	@ViewChild(FormGroupDirective) formDirective: FormGroupDirective;

	navsForm: FormGroup;
	tasks: SummaryTaskResponse[] = [];
	filteredTasks: SummaryTaskResponse[] = [];
	selectedSummary: SummaryDetailResponse | null = null;
	isLoading = false;
	isLoadingTasks = false;
	SummaryTaskStatus = SummaryTaskStatus;
	navsFilter = '';
	sortOrder: 'asc' | 'desc' = 'desc';

	constructor(
		private readonly fb: FormBuilder,
		private readonly summaryService: SummaryService,
		private readonly notif: ObNotificationService
	) {
		this.navsForm = this.fb.group({
			navs: ['', [Validators.required, Validators.pattern(/^\d{3}\.?\d{4}\.?\d{4}\.?\d{2}$/)]]
		});
	}

	ngOnInit(): void {
		this.loadTasks();
	}

	loadTasks(): void {
		this.isLoadingTasks = true;
		this.summaryService.getAllTasks().subscribe({
			next: tasks => {
				this.tasks = tasks;
				this.applyFilter();
				this.isLoadingTasks = false;
			},
			error: err => {
				console.error('Erreur lors du chargement des tâches', err);
				this.notif.error('career-summary.error.load-tasks');
				this.isLoadingTasks = false;
			}
		});
	}

	createSummary(): void {
		if (this.navsForm.invalid) {
			return;
		}

		this.isLoading = true;
		const navs = this.navsForm.value.navs.replaceAll('.', '');

		this.summaryService.createSummary(navs).subscribe({
			next: response => {
				this.notif.success('career-summary.success.create');
				this.formDirective.resetForm();
				this.loadTasks();
				this.isLoading = false;

				// Si la tâche est déjà terminée, l'afficher
				if (response.status === SummaryTaskStatus.TERMINEE) {
					this.viewSummary(response.id);
				}
			},
			error: err => {
				console.error('Erreur lors de la création du résumé', err);
				this.notif.error('career-summary.error.create');
				this.isLoading = false;
			}
		});
	}

	viewSummary(id: number): void {
		this.summaryService.getSummaryDetail(id).subscribe({
			next: detail => {
				this.selectedSummary = detail;
			},
			error: err => {
				console.error('Erreur lors du chargement du résumé', err);
				if (err.status === 409) {
					this.notif.warning('career-summary.error.not-completed');
				} else if (err.status === 404) {
					this.notif.error('career-summary.error.not-found');
				} else {
					this.notif.error('career-summary.error.load-detail');
				}
			}
		});
	}

	closeSummary(): void {
		this.selectedSummary = null;
	}

	retrySummary(id: number, event: Event): void {
		event.stopPropagation();
		this.summaryService.retrySummary(id).subscribe({
			next: () => {
				this.notif.success('career-summary.success.retry');
				if (this.selectedSummary) {
					this.closeSummary();
				}
				this.loadTasks();
			},
			error: err => {
				console.error('Erreur lors de la relance du résumé', err);
				this.notif.error('career-summary.error.retry');
			}
		});
	}

	openReferences(id: number): void {
		this.summaryService.openReferences(id).subscribe({
			next: response => {
				this.notif.success({
					message: 'career-summary.success.open-references',
					messageParams: {count: response.referencesCount}
				});
			},
			error: err => {
				console.error("Erreur lors de l'ouverture des références", err);
				this.notif.error('career-summary.error.open-references');
			}
		});
	}

	applyFilter(): void {
		if (this.navsFilter) {
			const normalizedFilter = this.navsFilter.replaceAll('.', '').toLowerCase();
			this.filteredTasks = this.tasks.filter(task => task.navs.replaceAll('.', '').toLowerCase().includes(normalizedFilter));
		} else {
			this.filteredTasks = [...this.tasks];
		}
		this.applySorting();
	}

	clearFilter(): void {
		this.navsFilter = '';
		this.applyFilter();
	}

	applySorting(): void {
		this.filteredTasks.sort((a, b) => {
			const dateA = new Date(a.createdAt).getTime();
			const dateB = new Date(b.createdAt).getTime();
			return this.sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
		});
	}

	getStatusClass(status: SummaryTaskStatus): string {
		switch (status) {
			case SummaryTaskStatus.EN_COURS:
				return 'status-in-progress';
			case SummaryTaskStatus.TERMINEE:
				return 'status-completed';
			case SummaryTaskStatus.ERREUR:
				return 'status-error';
			default:
				return '';
		}
	}

	getStatusIcon(status: SummaryTaskStatus): string {
		switch (status) {
			case SummaryTaskStatus.EN_COURS:
				return 'clock';
			case SummaryTaskStatus.TERMINEE:
				return 'checkmark';
			case SummaryTaskStatus.ERREUR:
				return 'cancel-circle';
			default:
				return 'info-circle';
		}
	}
}
