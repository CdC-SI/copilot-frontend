import {ChangeDetectionStrategy, Component, DestroyRef, NgZone, computed, inject, input, output, signal} from '@angular/core';
import {MatButton} from '@angular/material/button';
import {MatIcon} from '@angular/material/icon';
import {TranslatePipe} from '@ngx-translate/core';
import {ObButtonDirective} from '@oblique/oblique';
import {ToolApprovalDecision, ToolStep, formatToolArguments, isToolStepPending, toolLabelKey} from '../../../model/tool-step';

export type ToolApprovalState = 'pending' | 'sending' | 'approved' | 'rejected' | 'expired' | 'unavailable' | 'cancelled';

let nextCardId = 0;

/** Carte d'approbation d'un appel d'outil : arguments, compte à rebours, Autoriser / Refuser, puis état final. */
@Component({
	selector: 'zco-tool-approval-card',
	templateUrl: './tool-approval-card.component.html',
	styleUrl: './tool-approval-card.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [MatButton, ObButtonDirective, MatIcon, TranslatePipe]
})
export class ToolApprovalCardComponent {
	readonly step = input.required<ToolStep>();
	readonly decided = output<ToolApprovalDecision>();
	readonly titleId = `tool-approval-title-${nextCardId++}`;
	readonly labelKey = computed(() => toolLabelKey(this.step().name));
	readonly nameParams = computed(() => ({name: this.step().name}));
	readonly args = computed(() => formatToolArguments(this.step().arguments));
	readonly secondsLeft = computed(() => Math.max(0, Math.ceil((Date.parse(this.step().approval?.expiresAt) - this.now()) / 1000)));
	readonly state = computed<ToolApprovalState>(() => {
		const step = this.step();
		const {status, approval} = step;
		// Le résultat final du serveur (`tool_result`) prime sur l'état local de la décision.
		if (status === 'expired' || status === 'cancelled' || status === 'rejected') return status;
		if (!isToolStepPending(step)) return 'approved';
		if (approval?.sending) return 'sending';
		if (approval?.unavailable) return 'unavailable';
		if (approval?.decision) return approval.decision === 'APPROVE' ? 'approved' : 'rejected';
		return this.secondsLeft() > 0 ? 'pending' : 'expired';
	});
	private readonly now = signal(Date.now());

	constructor() {
		// Hors zone : le compte à rebours ne rafraîchit que cette carte (signal), pas toute l'application.
		const timer = inject(NgZone).runOutsideAngular(() => setInterval(() => this.now.set(Date.now()), 1000));
		inject(DestroyRef).onDestroy(() => clearInterval(timer));
	}

	decide(decision: ToolApprovalDecision): void {
		if (this.state() === 'pending') this.decided.emit(decision);
	}
}
