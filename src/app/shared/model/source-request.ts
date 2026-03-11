export enum SourceRequestStatus {
	WAITING = 'WAITING',
	PROCESSING = 'PROCESSING',
	INTEGRATED = 'INTEGRATED'
}

export interface ISourceRequest {
	id?: number;
	sourceName: string;
	description: string;
	requesterUsername?: string;
	status?: SourceRequestStatus;
	createdAt?: Date;
	updatedAt?: Date;
}
