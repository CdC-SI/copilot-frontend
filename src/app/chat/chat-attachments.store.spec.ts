import {TestBed} from '@angular/core/testing';
import {HttpErrorResponse, HttpEventType} from '@angular/common/http';
import {Subject, of, throwError} from 'rxjs';
import {AttachmentDTO, AttachmentStatus, AttachmentUploadResponse} from '../shared/model/chat-history';
import {ConversationService} from '../shared/services/conversation.service';
import {NotificationMock, notificationMock, provideNotificationMock} from '../../testing/angular';
import {aChatTitle} from '../../testing/fixtures';
import {ChatAttachmentsStore} from './chat-attachments.store';

// Interrogation du statut des pièces jointes (voir chat-attachments.store.ts) : phase rapide (2s pendant 10s)
// puis intervalle plus espacé (5s), jusqu'à MAX_ATTEMPTS tentatives.
const FAST_POLL_MS = 2_000;
const FAST_PHASE_MS = 10_000;
const SLOW_POLL_MS = 5_000;
const MAX_ATTEMPTS = 725;
const FAST_INTERVALS = FAST_PHASE_MS / FAST_POLL_MS;
const SLOW_INTERVALS = MAX_ATTEMPTS - 1 - FAST_INTERVALS;
// Temps total écoulé avant que la dernière tentative (MAX_ATTEMPTS) ne soit lancée.
const TIMEOUT_MS = FAST_INTERVALS * FAST_POLL_MS + SLOW_INTERVALS * SLOW_POLL_MS;

const dto = (id: number, filename: string, status: AttachmentStatus = 'PENDING', errorCode?: string): AttachmentDTO =>
	({id, filename, fileSize: 1, status, errorCode}) as AttachmentDTO;

const response = (conversationId: string, status: AttachmentStatus, attachments: AttachmentDTO[]): AttachmentUploadResponse =>
	({status, conversationAttachments: {conversationId, attachments}}) as AttachmentUploadResponse;

const uploaded = (body: AttachmentUploadResponse) => ({type: HttpEventType.Response, body});

describe('ChatAttachmentsStore', () => {
	let store: ChatAttachmentsStore;
	let upload: Subject<unknown>;
	let conversationService: {
		uploadAttachments: jest.Mock;
		getConversationAttachmentsStatus: jest.Mock;
		deleteAttachment: jest.Mock;
		downloadAttachment: jest.Mock;
	};
	let notif: NotificationMock;
	const conversation = aChatTitle({conversationId: 'c1'});
	const states = () => store.attachments().map(a => [a.fileName, a.status, a.isUploading]);

	beforeEach(() => {
		jest.useFakeTimers();
		upload = new Subject();
		notif = notificationMock();
		conversationService = {
			uploadAttachments: jest.fn(() => upload),
			getConversationAttachmentsStatus: jest.fn(),
			deleteAttachment: jest.fn(() => of(undefined)),
			downloadAttachment: jest.fn()
		};
		TestBed.configureTestingModule({
			providers: [ChatAttachmentsStore, {provide: ConversationService, useValue: conversationService}, provideNotificationMock(notif)]
		});
		store = TestBed.inject(ChatAttachmentsStore);
	});

	afterEach(() => {
		store.ngOnDestroy();
		jest.useRealTimers();
	});

	it('ignore une réponse d’envoi tardive sans changer la conversation courante', () => {
		const resolveConversation = jest.fn((conversationId: string) => conversationId);
		store.upload([new File(['x'], 'a.txt')], null, resolveConversation);

		store.reset();
		upload.next(uploaded(response('old', 'PENDING', [])));

		expect(resolveConversation).not.toHaveBeenCalled();
		expect(store.attachments()).toEqual([]);
	});

	describe('envoi', () => {
		it('affiche les fichiers en cours d’envoi, ignore la progression puis applique la réponse', () => {
			const resolveConversation = jest.fn(() => 'c1');
			const file = new File(['x'], 'a.pdf');

			store.upload([file], null, resolveConversation);
			expect(store.isUploading()).toBe(true);
			expect(conversationService.uploadAttachments).toHaveBeenCalledWith(null, file);

			upload.next({type: HttpEventType.UploadProgress, loaded: 1});
			expect(resolveConversation).not.toHaveBeenCalled();

			upload.next(uploaded(response('srv', 'PROCESSED', [dto(7, 'a.pdf', 'PROCESSED')])));

			expect(resolveConversation).toHaveBeenCalledWith('srv');
			expect(store.attachments()[0]).toEqual(expect.objectContaining({id: 7, status: 'PROCESSED', isUploading: false}));
			expect(notif.success).toHaveBeenCalledWith('attachment.process.success');
		});

		it('notifie un traitement en échec', () => {
			store.upload([new File(['x'], 'a.pdf')], null, () => 'c1');

			upload.next(uploaded(response('c1', 'FAILED', [dto(7, 'a.pdf', 'FAILED', 'UNSUPPORTED')])));

			expect(store.attachments()[0]).toEqual(expect.objectContaining({status: 'FAILED', errorCode: 'UNSUPPORTED'}));
			expect(notif.error).toHaveBeenCalledWith('attachment.process.error');
		});

		it('retire les fichiers refusés et notifie l’erreur', () => {
			store.upload([new File(['x'], 'a.pdf')], null, () => 'c1');

			upload.error(new HttpErrorResponse({status: 413}));

			expect(store.attachments()).toEqual([]);
			expect(notif.error).toHaveBeenCalled();
		});
	});

	describe('suivi du traitement', () => {
		it('interroge le backend jusqu’à la fin du traitement', () => {
			const status = new Subject<AttachmentUploadResponse>();
			conversationService.getConversationAttachmentsStatus.mockReturnValue(status);
			store.upload([new File(['x'], 'a.pdf'), new File(['y'], 'b.pdf')], aChatTitle({conversationId: 'c1'}), id => id);

			upload.next(uploaded(response('c1', 'PENDING', [dto(1, 'a.pdf'), dto(2, 'b.pdf')])));
			jest.advanceTimersByTime(0); // déclenche la première interrogation (immédiate)
			status.next(response('c1', 'PENDING', [dto(1, 'a.pdf', 'PROCESSED'), dto(2, 'b.pdf')]));

			expect(conversationService.getConversationAttachmentsStatus).toHaveBeenCalledWith('c1');
			expect(states()).toEqual([
				['a.pdf', 'PROCESSED', false],
				['b.pdf', 'PENDING', true]
			]);
			expect(notif.success).not.toHaveBeenCalled();

			status.next(response('c1', 'PROCESSED', [dto(1, 'a.pdf', 'PROCESSED'), dto(2, 'b.pdf', 'PROCESSED')]));

			expect(store.isUploading()).toBe(false);
			expect(notif.success).toHaveBeenCalledWith('attachment.process.success');
		});

		it('reprend le suivi des pièces jointes en attente d’une conversation chargée', () => {
			conversationService.getConversationAttachmentsStatus.mockReturnValue(of(response('c1', 'PROCESSED', [dto(1, 'a.pdf', 'PROCESSED')])));

			store.load('c1', [dto(1, 'a.pdf'), dto(2, 'b.pdf', 'PROCESSED')]);
			expect(store.isUploading()).toBe(true);
			jest.advanceTimersByTime(0); // déclenche la première interrogation (immédiate)

			expect(states()).toEqual([
				['a.pdf', 'PROCESSED', false],
				['b.pdf', 'PROCESSED', false]
			]);
		});

		it('ne suit pas une conversation sans traitement en cours', () => {
			store.load('c1', [dto(1, 'a.pdf', 'PROCESSED')]);
			jest.advanceTimersByTime(SLOW_POLL_MS * 2);

			expect(conversationService.getConversationAttachmentsStatus).not.toHaveBeenCalled();
		});

		it('propose un rafraîchissement manuel après la dernière tentative', () => {
			conversationService.getConversationAttachmentsStatus.mockImplementation(() => of(response('c1', 'PENDING', [dto(1, 'a.pdf')])));
			store.load('c1', [dto(1, 'a.pdf')]);

			jest.advanceTimersByTime(TIMEOUT_MS);

			expect(store.pollingTimedOut()).toBe(true);
			expect(notif.warning).toHaveBeenCalledWith('attachment.process.timeout');

			store.refresh('c1');
			expect(store.pollingTimedOut()).toBe(false);
		});

		it('suspend le suivi au changement de conversation', () => {
			store.load('c1', [dto(1, 'a.pdf')]);

			store.suspend();
			jest.advanceTimersByTime(SLOW_POLL_MS * 2);

			expect(conversationService.getConversationAttachmentsStatus).not.toHaveBeenCalled();
			expect(store.attachments()).toHaveLength(1);
		});

		it('ne relance pas le suivi sans conversation', () => {
			store.refresh(undefined);
			jest.advanceTimersByTime(FAST_POLL_MS);

			expect(conversationService.getConversationAttachmentsStatus).not.toHaveBeenCalled();
		});
	});

	describe('nouvel essai', () => {
		const failed = () => {
			const file = new File(['x'], 'a.pdf');
			store.upload([file], conversation, () => 'c1');
			upload.next(uploaded(response('c1', 'FAILED', [dto(1, 'a.pdf', 'FAILED')])));
			return store.attachments()[0];
		};

		it('renvoie le fichier et applique le nouveau statut', () => {
			const attachment = failed();
			const retry = new Subject<unknown>();
			conversationService.uploadAttachments.mockReturnValue(retry);

			store.retry(attachment, conversation);
			expect(states()).toEqual([['a.pdf', 'PENDING', true]]);

			retry.next(uploaded(response('c1', 'PROCESSED', [dto(2, 'a.pdf', 'PROCESSED')])));
			expect(store.attachments()[0]).toEqual(expect.objectContaining({id: 2, status: 'PROCESSED'}));
		});

		it('repasse en échec avec le code d’erreur', () => {
			const attachment = failed();
			conversationService.uploadAttachments.mockReturnValue(throwError(() => new HttpErrorResponse({status: 400, error: {code: 'TOO_LARGE'}})));

			store.retry(attachment, conversation);

			expect(store.attachments()[0]).toEqual(expect.objectContaining({status: 'FAILED', isUploading: false}));
			expect(notif.error).toHaveBeenCalledTimes(2);
		});

		it('exige le fichier local et une conversation', () => {
			store.retry({fileName: 'a.pdf', status: 'FAILED'}, conversation);
			store.retry(failed(), null);

			expect(conversationService.uploadAttachments).toHaveBeenCalledTimes(1);
		});
	});

	it('supprime une pièce jointe', () => {
		store.load('c1', [dto(1, 'a.pdf', 'PROCESSED'), dto(2, 'b.pdf', 'PROCESSED')]);

		store.remove(1);

		expect(conversationService.deleteAttachment).toHaveBeenCalledWith(1);
		expect(store.attachments().map(a => a.id)).toEqual([2]);
		expect(notif.success).toHaveBeenCalledWith('attachment.delete.success');
	});

	describe('téléchargement', () => {
		let click: jest.SpyInstance;

		beforeEach(() => {
			globalThis.URL.createObjectURL = jest.fn(() => 'blob:x');
			globalThis.URL.revokeObjectURL = jest.fn();
			click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
		});

		afterEach(() => click.mockRestore());

		it('enregistre le fichier sous son nom', () => {
			conversationService.downloadAttachment.mockReturnValue(of(new Blob(['x'])));

			store.download({id: 1, fileName: 'a.pdf', status: 'PROCESSED'}, 'c1');

			expect(conversationService.downloadAttachment).toHaveBeenCalledWith('c1', 1);
			expect(click).toHaveBeenCalled();
			expect(globalThis.URL.revokeObjectURL).toHaveBeenCalledWith('blob:x');
		});

		it('notifie un échec', () => {
			conversationService.downloadAttachment.mockReturnValue(throwError(() => new Error('KO')));

			store.download({id: 1, fileName: 'a.pdf', status: 'PROCESSED'}, 'c1');

			expect(notif.error).toHaveBeenCalledWith('attachment.download.error');
		});

		it.each([
			['sans identifiant', {fileName: 'a.pdf', status: 'PENDING' as const}, 'c1'],
			['en cours d’envoi', {id: 1, fileName: 'a.pdf', status: 'PENDING' as const, isUploading: true}, 'c1'],
			['sans conversation', {id: 1, fileName: 'a.pdf', status: 'PROCESSED' as const}, undefined]
		])('ne télécharge rien %s', (_, attachment, conversationId) => {
			store.download(attachment, conversationId);

			expect(conversationService.downloadAttachment).not.toHaveBeenCalled();
		});
	});
});
