/**
 * Codes d'erreur renvoyés par le backend lors d'un upload (cf. UploadErrorCode côté backend).
 * Chaque code est traduit via la clé `upload.errors.<CODE>`.
 */
export type UploadErrorCode =
	| 'NO_FILE'
	| 'FILE_TOO_LARGE'
	| 'FILE_TYPE_UNSUPPORTED'
	| 'FILE_CONTENT_INVALID'
	| 'CSV_CONTENT_INVALID'
	| 'FILE_READ_ERROR'
	| 'UPLOAD_FAILED'
	| 'EMBEDDING_REJECTED'
	| 'EMBEDDING_TIMEOUT'
	| 'EMBEDDING_NO_CONTENT'
	| 'EMBEDDING_FAILED'
	| 'OCR_FAILED';

export const UPLOAD_ERROR_CODES: readonly UploadErrorCode[] = [
	'NO_FILE',
	'FILE_TOO_LARGE',
	'FILE_TYPE_UNSUPPORTED',
	'FILE_CONTENT_INVALID',
	'CSV_CONTENT_INVALID',
	'FILE_READ_ERROR',
	'UPLOAD_FAILED',
	'EMBEDDING_REJECTED',
	'EMBEDDING_TIMEOUT',
	'EMBEDDING_NO_CONTENT',
	'EMBEDDING_FAILED',
	'OCR_FAILED'
];

/**
 * Corps d'erreur renvoyé par le backend (ExceptionsHandler).
 * `MESSAGE` contient un ou plusieurs codes séparés par des virgules (erreurs de validation).
 */
export interface UploadErrorResponse {
	STATUS: number;
	MESSAGE: string;
	PATH: string;
	FILENAME?: string;
}
