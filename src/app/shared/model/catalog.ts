/** Rapport d'un type d'élément (sources ou workspaces) après import du catalogue. */
export interface CatalogItemReport {
	created: string[];
	updated: string[];
	unchanged: string[];
}

/** Réponse de POST /api/admin/catalog/import */
export interface CatalogImportReport {
	sources: CatalogItemReport;
	workspaces: CatalogItemReport;
}

/** Corps d'erreur 400 de POST /api/admin/catalog/import */
export interface CatalogImportError {
	error: string;
	messages: string[];
}
