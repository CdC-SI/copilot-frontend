export interface IQuestion {
	id?: string;
	language: Language;
	text: string;
	url: string;
	answer?: IAnswer;
}

export interface IAnswer {
	language: Language;
	text: string;
	url: string;
}

export enum Language {
	IT = 'it',
	DE = 'de',
	FR = 'fr'
}
