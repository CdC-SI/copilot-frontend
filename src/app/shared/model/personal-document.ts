import {UploadErrorCode} from './upload-error';

export interface IPersonalDocument {
	title: string;
	uploadedAt: Date;
	status?: 'PENDING' | 'PROCESSED' | 'FAILED';
	availabilityStatus?: 'ACTIVE' | 'ARCHIVED';
	timeToLiveInDays?: number;
	/** Cause de l'échec du traitement, renseignée uniquement si status === 'FAILED'. */
	errorCode?: UploadErrorCode;
}
