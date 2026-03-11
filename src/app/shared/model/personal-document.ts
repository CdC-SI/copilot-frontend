export interface IPersonalDocument {
	title: string;
	uploadedAt: Date;
	status?: 'PENDING' | 'PROCESSED' | 'FAILED';
}
