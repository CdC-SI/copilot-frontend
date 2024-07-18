export enum FaqItemFields {
	ID = 'id',
	QUESTION = 'question',
	ANSWER = 'answer',
	SOURCE = 'url',
	LANGUAGE = 'language'
}

export interface IFaqItem {
	id?: number;
	question: string;
	answer: string;
	url: string;
	language: string;
}
