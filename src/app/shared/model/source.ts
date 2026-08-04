/** Contenu d'une source : soit un document (title), soit une page web (url), l'un des deux est renseigné. */
export interface SourceContentDto {
	title?: string | null;
	url?: string | null;
}

export interface SourceDto {
	id: number;
	name: string;
	description?: string | null;
	hypotheticalQuestions: string[];
	contents: SourceContentDto[];
	createdAt: string;
	updatedAt: string;
}

/** Pour POST /api/sources */
export interface CreateSourceRequest {
	name: string;
	description?: string | null;
	hypotheticalQuestions?: string[];
}

/** Pour PUT /api/sources/{name} */
export interface UpdateSourceRequest {
	description?: string | null;
	hypotheticalQuestions?: string[];
}
