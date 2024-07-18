export enum FaqItemFields {
	QUESTION = 'question',
	ANSWER = 'answer',
	SOURCE = 'url',
	LANGUAGE = 'language'
}

export interface IFaqItem {
	question: string;
	answer: string;
	url: string;
	language: string;
}
