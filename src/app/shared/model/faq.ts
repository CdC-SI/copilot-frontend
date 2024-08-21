export enum FaqItemFields {
	ID = 'id',
	QUESTION = 'text',
	ANSWER = 'answer',
	SOURCE = 'url',
	LANGUAGE = 'language'
}

export interface IFaqItem {
	id?: number;
	text: string;
	answer: string;
	url: string;
	language: string;
}
