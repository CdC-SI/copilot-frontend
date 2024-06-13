export interface ChatMessage {
	message?: string;
	fromMe: boolean;
	timestamp: Date;
	url?: string;
}
