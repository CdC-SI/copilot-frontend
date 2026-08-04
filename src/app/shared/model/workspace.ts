export interface WorkspaceDto {
	id: number;
	name: string;
	description?: string | null;
	hypotheticalQuestions: string[];
	sources: string[];
	createdAt: string;
	updatedAt: string;
}

/** Pour POST /api/workspaces */
export interface CreateWorkspaceRequest {
	name: string;
	description?: string | null;
	hypotheticalQuestions?: string[];
	sources?: string[];
}

/** Pour PUT /api/workspaces/{name} */
export interface UpdateWorkspaceRequest {
	description?: string | null;
	hypotheticalQuestions?: string[];
	sources?: string[];
}
