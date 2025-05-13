export interface IPage<T> {
	content: T[];
	totalElements: number;
	totalPages: number;
}
