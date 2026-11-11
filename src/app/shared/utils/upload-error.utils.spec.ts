import {HttpErrorResponse, HttpStatusCode} from '@angular/common/http';
import {extractUploadErrorCode, isRetryableUploadError, uploadErrorNotification} from './upload-error.utils';

describe('upload-error utils', () => {
	const httpError = (status: number, error: unknown) => new HttpErrorResponse({status, error});

	it('extracts the error code returned by the backend', () => {
		const error = httpError(HttpStatusCode.BadRequest, {STATUS: 400, MESSAGE: 'FILE_TYPE_UNSUPPORTED', PATH: '/api/conversations/attachments'});

		expect(extractUploadErrorCode(error)).toBe('FILE_TYPE_UNSUPPORTED');
	});

	it('extracts the first known code from joined validation messages', () => {
		const error = httpError(HttpStatusCode.BadRequest, {STATUS: 400, MESSAGE: 'must not be blank, FILE_TOO_LARGE', PATH: '/api/documents/upload'});

		expect(extractUploadErrorCode(error)).toBe('FILE_TOO_LARGE');
	});

	it('maps a 413 without code to FILE_TOO_LARGE', () => {
		const error = httpError(HttpStatusCode.PayloadTooLarge, {STATUS: 413, MESSAGE: 'File too large', PATH: '/api/documents/upload'});

		expect(extractUploadErrorCode(error)).toBe('FILE_TOO_LARGE');
	});

	it('returns undefined for unknown errors', () => {
		expect(extractUploadErrorCode(httpError(HttpStatusCode.InternalServerError, null))).toBeUndefined();
		expect(extractUploadErrorCode(new Error('boom'))).toBeUndefined();
	});

	it('builds a translated notification with the backend file name as title', () => {
		const error = httpError(HttpStatusCode.BadRequest, {STATUS: 400, MESSAGE: 'FILE_CONTENT_INVALID', PATH: '/x', FILENAME: 'empty.pdf'});

		expect(uploadErrorNotification(error, 'fallback.key', 'local.pdf')).toEqual({message: 'upload.errors.FILE_CONTENT_INVALID', title: 'empty.pdf'});
	});

	it('falls back to the given key and local file name when no code is returned', () => {
		const error = httpError(HttpStatusCode.InternalServerError, null);

		expect(uploadErrorNotification(error, 'fallback.key', 'local.pdf')).toEqual({message: 'fallback.key', title: 'local.pdf'});
		expect(uploadErrorNotification(error, 'fallback.key')).toEqual({message: 'fallback.key'});
	});

	it('considers file-related errors as not retryable', () => {
		expect(isRetryableUploadError('FILE_TYPE_UNSUPPORTED')).toBe(false);
		expect(isRetryableUploadError('FILE_CONTENT_INVALID')).toBe(false);
		expect(isRetryableUploadError('OCR_FAILED')).toBe(true);
		expect(isRetryableUploadError(undefined)).toBe(true);
	});
});
