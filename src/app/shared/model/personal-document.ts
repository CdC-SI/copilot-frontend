export interface IPersonalDocument {
	title: string;
	uploadedAt: Date;
	status?: 'PENDING' | 'PROCESSED' | 'FAILED';
	availabilityStatus?: 'ACTIVE' | 'ARCHIVED';
	timeToLiveInDays?: number;
}
