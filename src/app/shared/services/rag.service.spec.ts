import {TestBed} from '@angular/core/testing';
import {of} from 'rxjs';
import {ConfigurationService} from '../../core/app-configuration/configuration.service';
import {ChatStreamEvent} from '../model/chat-stream-event';
import {Language} from '../model/answer';
import {RagService} from './rag.service';
import {SseClientService} from './sse-client.service';

describe('RagService', () => {
	let service: RagService;
	let post: jest.Mock;

	beforeEach(() => {
		post = jest.fn(() => of({event: 'start', data: '{"messageId":"g1"}'}, {event: 'inconnu', data: '{}'}, {event: 'text_delta', data: '{"text":"Bonjour"}'}));
		TestBed.configureTestingModule({
			providers: [
				{provide: SseClientService, useValue: {post}},
				{provide: ConfigurationService, useValue: {backendApi: (path: string) => `/zia/api${path}`}}
			]
		});
		service = TestBed.inject(RagService);
	});

	it('type les événements du flux et ignore les types inconnus', () => {
		const events: ChatStreamEvent[] = [];

		service.process({query: 'Question'}).subscribe(event => events.push(event));

		expect(events).toEqual([
			{type: 'start', data: {messageId: 'g1'}},
			{type: 'text_delta', data: {text: 'Bonjour'}}
		]);
	});

	it('envoie la question et les seuls paramètres renseignés', () => {
		service.process({query: 'Question', language: Language.FR, conversationId: 'c1', workspace: undefined, replaceMessageId: 'a1'}).subscribe();

		const [url, form] = post.mock.calls[0] as [string, FormData];
		expect(url).toBe('/zia/api/conversations');
		expect(Object.fromEntries(form.entries())).toEqual({query: 'Question', language: Language.FR, conversationId: 'c1', replaceMessageId: 'a1'});
	});

	it('transmet l’espace de travail choisi', () => {
		service.process({query: 'Q', workspace: 'AVS'}).subscribe();

		const form = post.mock.calls[0][1] as FormData;
		expect(form.get('workspace')).toBe('AVS');
		expect(form.has('language')).toBe(false);
	});
});
