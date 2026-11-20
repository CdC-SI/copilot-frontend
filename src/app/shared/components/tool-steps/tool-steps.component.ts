import {ChangeDetectionStrategy, Component, LOCALE_ID, computed, inject, input, output, signal} from '@angular/core';
import {formatNumber} from '@angular/common';
import {MatIcon} from '@angular/material/icon';
import {MatProgressSpinner} from '@angular/material/progress-spinner';
import {MatTooltip} from '@angular/material/tooltip';
import {TranslatePipe} from '@ngx-translate/core';
import {ToolApprovalRequest, ToolStep, formatToolArguments, isToolStepPending, toolLabelKey} from '../../model/tool-step';
import {ToolApprovalCardComponent} from './tool-approval-card/tool-approval-card.component';

type StepTone = 'success' | 'info' | 'warning' | 'muted';

const STATUS_DISPLAY: Record<string, {icon: string; tone: StepTone}> = {
	awaiting_approval: {icon: 'shield_lock', tone: 'warning'},
	ok: {icon: 'checkmark_circle', tone: 'success'},
	no_result: {icon: 'info_circle', tone: 'info'},
	invalid_arguments: {icon: 'exclamation_circle', tone: 'warning'},
	budget_exhausted: {icon: 'exclamation_circle', tone: 'warning'},
	error: {icon: 'exclamation_circle', tone: 'warning'},
	rejected: {icon: 'xmark_circle', tone: 'muted'},
	expired: {icon: 'clock', tone: 'muted'},
	cancelled: {icon: 'xmark_circle', tone: 'muted'}
};

/**
 * Étapes d'outils d'une réponse, au-dessus du texte : une ligne par appel (état, outil, durée, documents), repliables
 * au-delà d'une étape (dépliées pendant la génération), et cartes d'approbation pendant la génération.
 */
@Component({
	selector: 'zco-tool-steps',
	templateUrl: './tool-steps.component.html',
	styleUrl: './tool-steps.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [MatIcon, MatProgressSpinner, MatTooltip, TranslatePipe, ToolApprovalCardComponent]
})
export class ToolStepsComponent {
	readonly steps = input.required<ToolStep[]>();
	readonly generating = input(false);
	readonly approvalDecided = output<ToolApprovalRequest>();
	readonly collapsible = computed(() => this.steps().length > 1);
	readonly expanded = computed(() => !this.collapsible() || (this.expandedByUser() ?? this.generating()));
	readonly pending = computed(() => this.steps().some(isToolStepPending));
	/** Cartes d'approbation : affichées jusqu'à la fin de la réponse, avec leur état final. */
	readonly approvals = computed(() => (this.generating() ? this.steps().filter(step => step.approval) : []));
	/** Choix explicite de l'utilisateur ; à défaut, la liste suit la génération. */
	private readonly expandedByUser = signal<boolean | null>(null);
	private readonly locale = inject(LOCALE_ID);

	toggle(): void {
		this.expandedByUser.set(!this.expanded());
	}

	icon(step: ToolStep): string {
		return STATUS_DISPLAY[step.status]?.icon ?? 'info_circle';
	}

	tone(step: ToolStep): StepTone {
		return step.status === 'running' ? 'info' : (STATUS_DISPLAY[step.status]?.tone ?? 'info');
	}

	statusKey(step: ToolStep): string {
		return step.status === 'running' || STATUS_DISPLAY[step.status] ? `chat.tools.status.${step.status}` : 'chat.tools.status.other';
	}

	labelKey(step: ToolStep): string {
		return toolLabelKey(step.name);
	}

	duration(step: ToolStep): string | null {
		if (!step.durationMs || isToolStepPending(step)) return null;
		return step.durationMs < 1000 ? `${step.durationMs} ms` : `${formatNumber(step.durationMs / 1000, this.locale, '1.1-1')} s`;
	}

	documentsKey(step: ToolStep): string {
		return step.documentCount === 1 ? 'chat.tools.documents.one' : 'chat.tools.documents.other';
	}

	argumentsText(step: ToolStep): string {
		return formatToolArguments(step.arguments)
			.map(({key, value}) => `${key} : ${value}`)
			.join(' · ');
	}
}
