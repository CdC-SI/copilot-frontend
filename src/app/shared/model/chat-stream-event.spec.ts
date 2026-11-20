import {toChatStreamEvent} from './chat-stream-event';

describe('toChatStreamEvent', () => {
	it('convertit un événement SSE nommé en événement typé', () => {
		expect(toChatStreamEvent({event: 'text_delta', data: '{"text":" mot"}'})).toEqual({type: 'text_delta', data: {text: ' mot'}});
		expect(toChatStreamEvent({event: 'done', data: '{"messageId":"m","interrupted":false}'})).toEqual({
			type: 'done',
			data: {messageId: 'm', interrupted: false}
		});
	});

	it('convertit les événements d’appel d’outil et d’approbation', () => {
		expect(toChatStreamEvent({event: 'tool_call', data: '{"id":"t1","name":"get_documents","arguments":{"ids":[1]}}'})).toEqual({
			type: 'tool_call',
			data: {id: 't1', name: 'get_documents', arguments: {ids: [1]}}
		});
		expect(toChatStreamEvent({event: 'approval_required', data: '{"id":"t1","approvalId":"a1"}'})?.type).toBe('approval_required');
		expect(toChatStreamEvent({event: 'tool_result', data: '{"id":"t1","status":"ok"}'})?.type).toBe('tool_result');
	});

	it('ignore les événements de type inconnu', () => {
		expect(toChatStreamEvent({event: 'message', data: 'texte'})).toBeNull();
		expect(toChatStreamEvent({event: 'thinking', data: '{}'})).toBeNull();
	});

	it('lève une erreur sur un JSON invalide', () => {
		expect(() => toChatStreamEvent({event: 'start', data: '{'})).toThrow();
	});
});
