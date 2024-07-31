export interface IQuestion {
	id?: number;
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
