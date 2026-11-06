const PDF_MIME_TYPE = 'application/pdf';

export function isPdf(blob: Blob, filename: string): boolean {
	return blob.type === PDF_MIME_TYPE || filename.toLowerCase().endsWith('.pdf');
}

/**
 * Opens PDF documents in a new tab; other documents (Word, Excel, PowerPoint, ...) cannot be displayed
 * by the browser and are downloaded under their original file name.
 */
export function openOrDownloadBlob(blob: Blob, filename: string): void {
	if (isPdf(blob, filename)) {
		const url = window.URL.createObjectURL(new Blob([blob], {type: PDF_MIME_TYPE}));
		window.open(url, '_blank');
		return;
	}

	const url = window.URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = filename;
	document.body.appendChild(link);
	link.click();
	link.remove();
	window.URL.revokeObjectURL(url);
}
