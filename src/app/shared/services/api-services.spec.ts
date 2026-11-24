import {HttpRequest} from '@angular/common/http';
import {HttpTestingController} from '@angular/common/http/testing';
import {TestBed} from '@angular/core/testing';
import {TranslateService} from '@ngx-translate/core';
import {BehaviorSubject, Observable} from 'rxjs';
import {TEST_API, provideApiTesting, provideTranslateStub} from '../../../testing/angular';
import {SettingsType} from '../model/settings';
import {IUser} from '../model/user';
import {AuthenticationServiceV2} from './auth.service';
import {CatalogService} from './catalog.service';
import {ConversationService} from './conversation.service';
import {FaqItemsService} from './faq-items.service';
import {IdentityCheckService} from './identity-check.service';
import {RetentionConfigService} from './retention-config.service';
import {SettingsService} from './settings.service';
import {SourceRequestService} from './source-request.service';
import {SourceService} from './source.service';
import {SummaryService} from './summary.service';
import {UploadService} from './upload.service';
import {UserService} from './user.service';
import {VisionService} from './vision.service';
import {WorkspaceService} from './workspace.service';

/**
 * Services d'API sans logique propre : chaque méthode appelle la bonne route avec le bon verbe et le bon corps.
 * Les services porteurs de logique ont leur propre spec.
 */
interface ApiCase {
	name: string;
	call: () => Observable<unknown> | void;
	method: string;
	url: string;
	check?: (request: HttpRequest<unknown>) => void;
}

const file = (name = 'doc.pdf') => new File(['%PDF'], name, {type: 'application/pdf'});
const user = {username: 'u1'} as IUser;
const body = (request: HttpRequest<unknown>) => request.body as FormData;

describe('Services d’API', () => {
	let http: HttpTestingController;
	const svc = <T>(type: new () => T): T => TestBed.inject(type);

	beforeEach(() => {
		TestBed.configureTestingModule({
			providers: [
				...provideApiTesting(),
				provideTranslateStub('de'),
				{provide: AuthenticationServiceV2, useValue: {$authenticatedUser: new BehaviorSubject<IUser>(null)}}
			]
		});
		http = TestBed.inject(HttpTestingController);
		jest.spyOn(TestBed.inject(TranslateService), 'getCurrentLang').mockReturnValue('de');
	});

	afterEach(() => http.verify());

	const cases: ApiCase[] = [
		// Conversations
		{name: 'conversation: titres', call: () => svc(ConversationService).getConversationTitles(), method: 'GET', url: '/conversations/titles'},
		{name: 'conversation: lecture', call: () => svc(ConversationService).getConversation('c1'), method: 'GET', url: '/conversations/c1'},
		{
			name: 'conversation: initialisation',
			call: () => svc(ConversationService).init([]),
			method: 'POST',
			url: '/conversations/init',
			check: r => expect(r.body).toEqual([])
		},
		{
			name: 'conversation: mise à jour (souscrite par le service)',
			call: () => svc(ConversationService).update('c1', []),
			method: 'PUT',
			url: '/conversations/c1'
		},
		{
			name: 'conversation: arrêt de génération',
			call: () => svc(ConversationService).stopGeneration('c1', 'm1'),
			method: 'POST',
			url: '/conversations/c1/generations/m1/stop'
		},
		{
			name: 'conversation: décision d’approbation',
			call: () => svc(ConversationService).decideToolApproval('c1', 'a1', 'APPROVE'),
			method: 'POST',
			url: '/conversations/c1/approvals/a1',
			check: r => expect(r.body).toEqual({decision: 'APPROVE'})
		},
		{name: 'conversation: suppression', call: () => svc(ConversationService).deleteConversation('c1'), method: 'DELETE', url: '/conversations/c1'},
		{
			name: 'conversation: renommage',
			call: () => svc(ConversationService).renameConversation('c1', 'Titre'),
			method: 'PUT',
			url: '/conversations/titles/c1',
			check: r => expect(r.body).toEqual({newTitle: 'Titre'})
		},
		{
			name: 'conversation: envoi de pièces jointes rattachées',
			call: () => svc(ConversationService).uploadAttachments({conversationId: 'c1', title: 't', timestamp: new Date()}, file('a.pdf'), file('b.pdf')),
			method: 'POST',
			url: '/conversations/attachments?conversationId=c1',
			check: r => {
				expect(r.reportProgress).toBe(true);
				expect(
					body(r)
						.getAll('files')
						.map(f => (f as File).name)
				).toEqual(['a.pdf', 'b.pdf']);
			}
		},
		{
			name: 'conversation: envoi de pièces jointes sans conversation',
			call: () => svc(ConversationService).uploadAttachments(null, file()),
			method: 'POST',
			url: '/conversations/attachments',
			check: r => expect(r.params.keys()).toEqual([])
		},
		{
			name: 'conversation: suppression de pièce jointe',
			call: () => svc(ConversationService).deleteAttachment(7),
			method: 'DELETE',
			url: '/conversations/attachments/7'
		},
		{
			name: 'conversation: état des pièces jointes',
			call: () => svc(ConversationService).getConversationAttachmentsStatus('c1'),
			method: 'GET',
			url: '/conversations/c1/attachments'
		},
		{
			name: 'conversation: téléchargement de pièce jointe',
			call: () => svc(ConversationService).downloadAttachment('c1', 7),
			method: 'GET',
			url: '/conversations/c1/attachments/7',
			check: r => expect(r.responseType).toBe('blob')
		},
		// FAQ
		{name: 'faq: recherche', call: () => svc(FaqItemsService).search('AVS ?'), method: 'GET', url: '/faq-items?question=AVS%20?'},
		{
			name: 'faq: ajout',
			call: () => svc(FaqItemsService).add({question: 'q'} as never),
			method: 'POST',
			url: '/faq-items',
			check: r => expect(r.headers.get('Content-Type')).toBe('application/json')
		},
		// Catalogue
		{
			name: 'catalogue: import',
			call: () => svc(CatalogService).import(file('catalog.yml')),
			method: 'POST',
			url: '/admin/catalog/import',
			check: r => expect((body(r).get('file') as File).name).toBe('catalog.yml')
		},
		{
			name: 'catalogue: export',
			call: () => svc(CatalogService).export(),
			method: 'GET',
			url: '/admin/catalog/export',
			check: r => expect(r.responseType).toBe('blob')
		},
		// Vérification d'identité
		{
			name: 'identité: démarrage',
			call: () => svc(IdentityCheckService).startIdentyCheck({} as never),
			method: 'POST',
			url: '/identity-check/start'
		},
		{name: 'identité: état', call: () => svc(IdentityCheckService).getIdentityCheckStatus(), method: 'GET', url: '/identity-check/status'},
		// Rétention
		{name: 'rétention: lecture', call: () => svc(RetentionConfigService).get(), method: 'GET', url: '/documents/retention-config'},
		{name: 'rétention: mise à jour', call: () => svc(RetentionConfigService).update({} as never), method: 'PUT', url: '/documents/retention-config'},
		// Paramètres
		{name: 'paramètres: par type', call: () => svc(SettingsService).getSettings(SettingsType.TAG), method: 'GET', url: '/settings?type=TAG'},
		{name: 'paramètres: tags filtrés', call: () => svc(SettingsService).getFilteredTags('a,b'), method: 'GET', url: '/settings/tags?sources=a,b'},
		// Demandes de sources
		{name: 'demandes de sources: les miennes', call: () => svc(SourceRequestService).getMyRequests(), method: 'GET', url: '/source-requests/my'},
		{name: 'demandes de sources: création', call: () => svc(SourceRequestService).createRequest({} as never), method: 'POST', url: '/source-requests'},
		{name: 'demandes de sources: mise à jour', call: () => svc(SourceRequestService).updateRequest(3, {}), method: 'PUT', url: '/source-requests/3'},
		{name: 'demandes de sources: suppression', call: () => svc(SourceRequestService).deleteRequest(3), method: 'DELETE', url: '/source-requests/3'},
		// Sources (noms encodés)
		{name: 'sources: liste', call: () => svc(SourceService).getAll(), method: 'GET', url: '/sources'},
		{name: 'sources: lecture', call: () => svc(SourceService).getByName('a/b c'), method: 'GET', url: '/sources/a%2Fb%20c'},
		{name: 'sources: création', call: () => svc(SourceService).create({} as never), method: 'POST', url: '/sources'},
		{name: 'sources: mise à jour', call: () => svc(SourceService).update('a/b', {}), method: 'PUT', url: '/sources/a%2Fb'},
		{name: 'sources: suppression', call: () => svc(SourceService).delete('a/b'), method: 'DELETE', url: '/sources/a%2Fb'},
		// Espaces de travail (noms encodés)
		{name: 'workspaces: liste', call: () => svc(WorkspaceService).getAll(), method: 'GET', url: '/workspaces'},
		{name: 'workspaces: lecture', call: () => svc(WorkspaceService).getByName('w/1'), method: 'GET', url: '/workspaces/w%2F1'},
		{name: 'workspaces: création', call: () => svc(WorkspaceService).create({} as never), method: 'POST', url: '/workspaces'},
		{name: 'workspaces: mise à jour', call: () => svc(WorkspaceService).update('w/1', {}), method: 'PUT', url: '/workspaces/w%2F1'},
		{name: 'workspaces: suppression', call: () => svc(WorkspaceService).delete('w/1'), method: 'DELETE', url: '/workspaces/w%2F1'},
		// Résumés
		{name: 'résumés: création', call: () => svc(SummaryService).createSummary('7561234567897'), method: 'POST', url: '/summaries/7561234567897'},
		{name: 'résumés: tâches', call: () => svc(SummaryService).getAllTasks(), method: 'GET', url: '/summaries'},
		{name: 'résumés: détail', call: () => svc(SummaryService).getSummaryDetail(4), method: 'GET', url: '/summaries/4'},
		{name: 'résumés: nouvel essai', call: () => svc(SummaryService).retrySummary(4), method: 'PUT', url: '/summaries/4'},
		{name: 'résumés: références', call: () => svc(SummaryService).openReferences(4), method: 'POST', url: '/summaries/4/open-references'},
		// Utilisateurs
		{name: 'utilisateurs: création de compte', call: () => svc(UserService).createAccount(user), method: 'POST', url: '/users'},
		{
			name: 'utilisateurs: page triée',
			call: () => svc(UserService).getUsers(2, 20, 'username', 'desc'),
			method: 'GET',
			url: '/users?page=2&pageSize=20&sortField=username&sortDirection=DESC'
		},
		{name: 'utilisateurs: validation', call: () => svc(UserService).validate(user), method: 'PUT', url: '/users/u1/validate'},
		{name: 'utilisateurs: réactivation', call: () => svc(UserService).reactivateUser(user), method: 'PUT', url: '/users/u1/reactivate'},
		{name: 'utilisateurs: désactivation', call: () => svc(UserService).deactivateUser(user), method: 'PUT', url: '/users/u1/deactivate'},
		{
			name: 'utilisateurs: rôles',
			call: () => svc(UserService).updateUserRoles('u1', ['ADMIN']),
			method: 'PUT',
			url: '/users/u1/roles',
			check: r => expect(r.body).toEqual({roles: ['ADMIN']})
		},
		{name: 'utilisateurs: internalisation', call: () => svc(UserService).internalizeUser(user), method: 'PUT', url: '/users/u1/internalize'},
		{name: 'utilisateurs: externalisation', call: () => svc(UserService).externalizeUser(user), method: 'PUT', url: '/users/u1/externalize'},
		// Vision
		{
			name: 'vision: OCR',
			call: () => svc(VisionService).ocrFile(file(), 'nom,prénom'),
			method: 'POST',
			url: '/visualize/structure',
			check: r => expect(body(r).get('fields')).toBe('nom,prénom')
		},
		{name: 'vision: classification', call: () => svc(VisionService).classifyFile(file()), method: 'POST', url: '/visualize/classify'},
		{
			name: 'vision: traduction',
			call: () => svc(VisionService).translateFile(file(), 'it'),
			method: 'POST',
			url: '/visualize/translate',
			check: r => expect(body(r).get('language')).toBe('it')
		},
		{name: 'vision: Sumex', call: () => svc(VisionService).sumex(file()), method: 'POST', url: '/visualize/sumex'},
		{
			name: 'vision: conversion de facture',
			call: () => svc(VisionService).submitInvoice({} as never),
			method: 'POST',
			url: '/sumex-invoices/convert',
			check: r => expect(r.responseType).toBe('blob')
		},
		// Documents
		{
			name: 'upload: document personnel rattaché',
			call: () => svc(UploadService).uploadPersonalPdf(file('perso.pdf'), 'c1'),
			method: 'POST',
			url: '/documents/upload',
			check: r => {
				expect((body(r).get('multipartFile') as File).name).toBe('perso.pdf');
				expect(body(r).get('embed')).toBe('true');
				expect(body(r).get('lang')).toBe('de');
				expect(body(r).get('conversationId')).toBe('c1');
			}
		},
		{
			name: 'upload: document personnel seul',
			call: () => svc(UploadService).uploadPersonalPdf(file()),
			method: 'POST',
			url: '/documents/upload',
			check: r => expect(body(r).has('conversationId')).toBe(false)
		},
		{
			name: 'upload: documents admin',
			call: () => svc(UploadService).uploadAdminDocs([{file: file('a.pdf'), fileName: 'A.pdf'}]),
			method: 'POST',
			url: '/documents/upload-admin',
			check: r => expect((body(r).get('documents') as File).name).toBe('A.pdf')
		},
		{
			name: 'upload: téléchargement par nom',
			call: () => svc(UploadService).downloadSourceDocument('a b.pdf'),
			method: 'GET',
			url: '/documents?filename=a%20b.pdf',
			check: r => expect(r.responseType).toBe('blob')
		},
		{name: 'upload: suppression', call: () => svc(UploadService).deleteUserDocument('a.pdf'), method: 'DELETE', url: '/documents/user-docs?filename=a.pdf'},
		{
			name: 'upload: réactivation',
			call: () => svc(UploadService).reactivateUserDocument('a.pdf'),
			method: 'PUT',
			url: '/documents/user-docs/reactivate?filename=a.pdf'
		}
	];

	it.each(cases)('$name → $method $url', ({call, method, url, check}) => {
		const result = call() as Observable<unknown> | undefined;
		result?.subscribe();

		const request = http.expectOne(`${TEST_API}${url}`);
		expect(request.request.method).toBe(method);
		check?.(request.request);
		request.flush(null);
	});

	it('publie l’utilisateur authentifié rechargé', () => {
		svc(UserService).refreshAuthenticatedUser();

		http.expectOne(`${TEST_API}/users/authenticated`).flush({username: 'u2'});

		expect(TestBed.inject(AuthenticationServiceV2).$authenticatedUser.getValue()).toEqual({username: 'u2'});
	});

	it('convertit la date d’envoi des documents personnels', () => {
		let docs: {title: string; uploadedAt: Date}[] = [];
		svc(UploadService)
			.getUserDocuments()
			.subscribe(result => (docs = result));

		http
			.expectOne(`${TEST_API}/documents/user-docs`)
			.flush([
				{title: 'a.pdf', uploadedAt: '2026-01-15T10:00:00Z', status: 'PROCESSED', availabilityStatus: 'AVAILABLE', timeToLiveInDays: 30, extra: 'ignoré'}
			]);

		expect(docs).toEqual([
			{
				title: 'a.pdf',
				uploadedAt: new Date('2026-01-15T10:00:00Z'),
				status: 'PROCESSED',
				availabilityStatus: 'AVAILABLE',
				timeToLiveInDays: 30,
				errorCode: undefined
			}
		]);
	});
});
