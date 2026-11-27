/**
 * Worker de pdf.js bundlé par le build Angular (`worker-<hash>.js`) : servi comme du JavaScript par tout serveur,
 * contrairement au fichier `.mjs` de `pdfjs-dist`, que nginx envoie en `text/plain` (module refusé par le navigateur).
 * Isolé de `PdfJsService` et chargé à la demande : `import.meta` n'est pas pris en charge par Jest (CommonJS).
 */
export function createPdfWorker(): Worker {
	return new Worker(new URL('./pdf.worker', import.meta.url), {type: 'module'});
}
