/** Origine d'une source citée (`GET /api/source-documents/{id}`, F2b). */
export type SourceViewOrigin = 'DOCUMENT' | 'ATTACHMENT' | 'BUSINESS_PROCESS';

/**
 * Mode d'affichage proposé par le backend :
 * - `PDF` : fichier PDF affiché dans la visionneuse ;
 * - `DOWNLOAD` : autre fichier (DOCX, XLSX…), proposé au téléchargement ;
 * - `URL` : page d'origine externe ;
 * - `PROCESS` : processus métier (lien BPanda) ;
 * - `EXCERPT` : extrait seul (fichier indisponible ou non autorisé).
 */
export type SourceViewDisplay = 'PDF' | 'DOWNLOAD' | 'URL' | 'PROCESS' | 'EXCERPT';

/** Source citée résolue par le backend : métadonnées, extrait (texte du chunk) et mode d'affichage. */
export interface SourceView {
	id: string;
	origin: SourceViewOrigin;
	display: SourceViewDisplay;
	title?: string;
	url?: string;
	pageNumber?: string;
	subsection?: string;
	version?: string;
	state?: string;
	excerpt?: string;
	excerptTruncated: boolean;
	fileAvailable: boolean;
}
