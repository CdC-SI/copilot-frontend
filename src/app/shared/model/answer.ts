export interface IAnswer {
	answer?: string;
	created_at: Date;
	id?: number;
	language: Language;
	modified_at: Date;
	question: string;
	url: string;
}

export enum Language {
	IT = 'it',
	DE = 'de',
	FR = 'fr'
}
