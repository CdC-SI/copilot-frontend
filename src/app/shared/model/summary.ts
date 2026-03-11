export enum SummaryTaskStatus {
	ERREUR = 'ERREUR',
	TERMINEE = 'TERMINEE',
	EN_COURS = 'EN_COURS'
}

export interface SummaryDetailResponse {
	updatedAt: string;
	summaryMarkdown: string;
	navs: string;
	id: number;
}

export interface SummaryTaskResponse {
	updatedAt: string;
	createdAt: string;
	status: SummaryTaskStatus;
	navs: string;
	id: number;
}

export interface SummaryTaskCreatedResponse {
	navs: string;
	status: SummaryTaskStatus;
	message: string;
	id: number;
}
