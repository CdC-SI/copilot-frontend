import {HttpErrorResponse, HttpStatusCode} from '@angular/common/http';
import {ObINotification} from '@oblique/oblique';
import {UPLOAD_ERROR_CODES, UploadErrorCode, UploadErrorResponse} from '../model/upload-error';

const UPLOAD_ERROR_KEY_PREFIX = 'upload.errors.';

/** Codes pour lesquels renvoyer le même fichier ne peut pas réussir. */
const NON_RETRYABLE_CODES: readonly UploadErrorCode[] = ['FILE_TOO_LARGE', 'TOO_MANY_PAGES', 'FILE_TYPE_UNSUPPORTED', 'FILE_CONTENT_INVALID', 'CSV_CONTENT_INVALID'];

export function isUploadErrorCode(value: unknown): value is UploadErrorCode {
	return typeof value === 'string' && (UPLOAD_ERROR_CODES as readonly string[]).includes(value);
}

/** Clé de traduction associée à un code d'erreur d'upload. */
export function uploadErrorKey(code: UploadErrorCode): string {
	return UPLOAD_ERROR_KEY_PREFIX + code;
}

export function isRetryableUploadError(code: UploadErrorCode | undefined): boolean {
	return !code || !NON_RETRYABLE_CODES.includes(code);
}

/**
 * Extrait le premier code d'erreur connu d'une réponse HTTP d'upload.
 * Le dépassement de la limite multipart (413) est renvoyé par le backend sans code : il est assimilé à FILE_TOO_LARGE.
 */
export function extractUploadErrorCode(error: unknown): UploadErrorCode | undefined {
	if (!(error instanceof HttpErrorResponse)) {
		return undefined;
	}
	const body = error.error as Partial<UploadErrorResponse> | null;
	const code =
		typeof body?.MESSAGE === 'string'
			? body.MESSAGE.split(',')
					.map(part => part.trim())
					.find(isUploadErrorCode)
			: undefined;
	if (code) {
		return code;
	}
	return error.status === HttpStatusCode.PayloadTooLarge ? 'FILE_TOO_LARGE' : undefined;
}

/** Nom du fichier en erreur, s'il est renvoyé par le backend. */
export function extractUploadErrorFileName(error: unknown): string | undefined {
	if (!(error instanceof HttpErrorResponse)) {
		return undefined;
	}
	const fileName = (error.error as Partial<UploadErrorResponse> | null)?.FILENAME;
	return typeof fileName === 'string' && fileName ? fileName : undefined;
}

/**
 * Construit la notification d'erreur à afficher suite à un upload en échec :
 * message traduit à partir du code renvoyé par le backend (ou `fallbackKey` si inconnu),
 * et nom du fichier concerné en titre lorsqu'il est connu.
 */
export function uploadErrorNotification(error: unknown, fallbackKey: string, fileName?: string): ObINotification {
	const code = extractUploadErrorCode(error);
	const title = extractUploadErrorFileName(error) ?? fileName;
	return {
		message: code ? uploadErrorKey(code) : fallbackKey,
		...(title ? {title} : {})
	};
}
