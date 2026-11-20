import {TestBed} from '@angular/core/testing';
import {HttpEventType} from '@angular/common/http';
import {ObNotificationService} from '@oblique/oblique';
import {Subject} from 'rxjs';
import {ConversationService} from '../shared/services/conversation.service';
import {ChatAttachmentsStore} from './chat-attachments.store';

describe('ChatAttachmentsStore', () => {
	let store: ChatAttachmentsStore;
	let upload: Subject<unknown>;

	beforeEach(() => {
		upload = new Subject();
		TestBed.configureTestingModule({
			providers: [
				ChatAttachmentsStore,
				{provide: ConversationService, useValue: {uploadAttachments: jest.fn(() => upload)}},
				{provide: ObNotificationService, useValue: {success: jest.fn(), error: jest.fn()}}
			]
		});
		store = TestBed.inject(ChatAttachmentsStore);
	});

	it('ignore une réponse d’envoi tardive sans changer la conversation courante', () => {
		const resolveConversation = jest.fn((conversationId: string) => conversationId);
		store.upload([new File(['x'], 'a.txt')], null, resolveConversation);

		store.reset();
		upload.next({
			type: HttpEventType.Response,
			body: {status: 'PENDING', conversationAttachments: {conversationId: 'old', attachments: []}}
		});

		expect(resolveConversation).not.toHaveBeenCalled();
		expect(store.attachments()).toEqual([]);
	});
});
