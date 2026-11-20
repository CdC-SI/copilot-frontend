/** Statut final d'un appel d'outil, reçu dans `tool_result`. */
export type ToolResultStatus = 'ok' | 'no_result' | 'invalid_arguments' | 'budget_exhausted' | 'error' | 'rejected' | 'expired' | 'cancelled';

/** `running` : outil en cours d'exécution ; `awaiting_approval` : suspendu jusqu'à la décision de l'utilisateur. */
export type ToolStepStatus = 'running' | 'awaiting_approval' | ToolResultStatus;

export type ToolApprovalDecision = 'APPROVE' | 'REJECT';

/** Décision demandée depuis la carte d'approbation d'une étape. */
export interface ToolApprovalRequest {
	stepId: string;
	decision: ToolApprovalDecision;
}

export interface ToolApproval {
	approvalId: string;
	/** Instant ISO-8601 (UTC) au-delà duquel le backend refuse l'appel d'office. */
	expiresAt: string;
	/** Décision choisie par l'utilisateur. */
	decision?: ToolApprovalDecision;
	/** Décision en cours d'envoi au backend. */
	sending?: boolean;
	/** Demande inconnue du backend (404) : expirée, annulée ou déjà tranchée. */
	unavailable?: boolean;
}

/** Appel d'outil effectué par l'assistant pendant la génération d'une réponse (non conservé dans l'historique). */
export interface ToolStep {
	id: string;
	name: string;
	/** Arguments fournis par le LLM (valeurs textuelles tronquées par le backend). */
	arguments: Record<string, unknown>;
	status: ToolStepStatus;
	durationMs?: number;
	documentCount?: number;
	approval?: ToolApproval;
}

/** Outils connus du backend, dont le libellé est traduit (`chat.tools.name.<nom>`). */
export const KNOWN_TOOLS: ReadonlySet<string> = new Set([
	'search_social_insurance_documentation',
	'get_documents',
	'list_conversation_attachments',
	'get_attachment_content'
]);

/** Clé de traduction du nom d'un outil ; libellé générique (avec `{{name}}`) pour un outil inconnu. */
export const toolLabelKey = (name: string): string => (KNOWN_TOOLS.has(name) ? `chat.tools.name.${name}` : 'chat.tools.name.generic');

export const isToolStepPending = (step: ToolStep): boolean => step.status === 'running' || step.status === 'awaiting_approval';

/** Fin de la réponse sans `tool_result` (done, erreur, arrêt) : les étapes encore ouvertes passent à `cancelled`. */
export function cancelPendingToolSteps(steps: ToolStep[] | undefined): ToolStep[] | undefined {
	if (!steps?.some(isToolStepPending)) return steps;
	return steps.map(step => (isToolStepPending(step) ? {...step, status: 'cancelled'} : step));
}

/** Arguments affichables : texte tel quel, autres valeurs en JSON. */
export function formatToolArguments(args: Record<string, unknown> | undefined): {key: string; value: string}[] {
	return Object.entries(args ?? {}).map(([key, value]) => ({key, value: typeof value === 'string' ? value : JSON.stringify(value)}));
}
