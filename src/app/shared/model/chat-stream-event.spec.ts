import {toChatStreamEvent} from './chat-stream-event';

describe('toChatStreamEvent', () => {
	it('convertit un événement SSE nommé en événement typé', () => {
		expect(toChatStreamEvent({event: 'text_delta', data: '{"text":" mot"}'})).toEqual({type: 'text_delta', data: {text: ' mot'}});
		expect(toChatStreamEvent({event: 'done', data: '{"messageId":"m","interrupted":false}'})).toEqual({
			type: 'done',
			data: {messageId: 'm', interrupted: false}
		});
	});

	it('ignore les événements de type inconnu', () => {
		expect(toChatStreamEvent({event: 'message', data: 'texte'})).toBeNull();
		expect(toChatStreamEvent({event: 'tool_call', data: '{}'})).toBeNull();
	});

	it('lève une erreur sur un JSON invalide', () => {
		expect(() => toChatStreamEvent({event: 'start', data: '{'})).toThrow();
	});
});
