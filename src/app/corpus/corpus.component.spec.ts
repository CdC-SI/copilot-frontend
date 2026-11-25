import {TestbedHarnessEnvironment} from '@angular/cdk/testing/testbed';
import {HttpErrorResponse} from '@angular/common/http';
import {Component, input} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {MATERIAL_ANIMATIONS} from '@angular/material/core';
import {MatTabGroupHarness} from '@angular/material/tabs/testing';
import {By} from '@angular/platform-browser';
import {provideTranslateService} from '@ngx-translate/core';
import {ObEUploadEventType, ObFileUploadComponent} from '@oblique/oblique';
import {BehaviorSubject, Subject, of, throwError} from 'rxjs';
import {DialogMock, ObFileUploadStubComponent, aFile, dialogMock, provideDialogMock, provideFakeIcons, refresh} from '../../testing/admin';
import {NotificationMock, notificationMock, provideNotificationMock} from '../../testing/angular';
import {aUser} from '../../testing/fixtures';
import {SourceViewerPanelComponent} from '../shared/components/source-viewer/source-viewer-panel.component';
import {SourceViewerStore} from '../shared/components/source-viewer/source-viewer.store';
import {IPersonalDocument} from '../shared/model/personal-document';
import {ISourceRequest, SourceRequestStatus} from '../shared/model/source-request';
import {IUser} from '../shared/model/user';
import {AuthenticationServiceV2} from '../shared/services/auth.service';
import {SourceRequestService} from '../shared/services/source-request.service';
import {UploadService} from '../shared/services/upload.service';
import {CorpusComponent} from './corpus.component';
import {OfficialSourcesBrowserComponent} from './official-sources-browser/official-sources-browser.component';
import {RequestSourceDialogComponent} from './request-source-dialog/request-source-dialog.component';

@Component({selector: 'zco-official-sources-browser', template: ''})
class OfficialSourcesBrowserStubComponent {}

@Component({selector: 'zco-source-viewer-panel', template: ''})
class SourceViewerPanelStubComponent {
	readonly overlay = input(false);
}

function aPersonalDocument(doc: Partial<IPersonalDocument> = {}): IPersonalDocument {
	return {title: 'directive-avs.pdf', uploadedAt: new Date('2026-01-15T10:00:00'), status: 'PROCESSED', ...doc};
}

function aSourceRequest(request: Partial<ISourceRequest> = {}): ISourceRequest {
	return {
		id: 3,
		sourceName: 'Directives LAMal',
		description: 'Ajouter les directives LAMal',
		status: SourceRequestStatus.WAITING,
		createdAt: new Date('2026-01-15T10:00:00'),
		...request
	};
}

describe('CorpusComponent', () => {
	let fixture: ComponentFixture<CorpusComponent>;
	let component: CorpusComponent;
	let notifications: NotificationMock;
	let dialog: DialogMock;
	let user$: BehaviorSubject<IUser | null>;
	let uploadService: {
		getUserDocuments: jest.Mock;
		uploadPersonalPdf: jest.Mock;
		downloadSourceDocument: jest.Mock;
		deleteUserDocument: jest.Mock;
		reactivateUserDocument: jest.Mock;
	};
	let sourceRequestService: {getMyRequests: jest.Mock; createRequest: jest.Mock; deleteRequest: jest.Mock};
	const pdf = aPersonalDocument();
	const element = (): HTMLElement => fixture.nativeElement;
	const text = (selector: string, root: ParentNode = element()): string[] =>
		Array.from(root.querySelectorAll(selector)).map(node => node.textContent?.replace(/\s+/g, ' ').trim() ?? '');
	const upload = (): ObFileUploadStubComponent => fixture.debugElement.query(By.directive(ObFileUploadStubComponent)).componentInstance;
	const uploadButton = (): HTMLButtonElement => element().querySelector<HTMLButtonElement>('.actions button');
	const cards = (): HTMLElement[] => Array.from(element().querySelectorAll<HTMLElement>('mat-card.document-card'));
	const button = (root: HTMLElement, label: string): HTMLButtonElement | null => root.querySelector<HTMLButtonElement>(`button[aria-label^="${label}"]`);
	const viewer = (): SourceViewerStore => fixture.debugElement.injector.get(SourceViewerStore);

	function create(): void {
		fixture = TestBed.createComponent(CorpusComponent);
		component = fixture.componentInstance;
		refresh(fixture);
	}

	async function openRequestsTab(): Promise<void> {
		const tabs = await TestbedHarnessEnvironment.loader(fixture).getHarness(MatTabGroupHarness);
		await tabs.selectTab({label: 'sources.requests.tab.title'});
		refresh(fixture);
	}

	beforeEach(() => {
		notifications = notificationMock();
		dialog = dialogMock();
		user$ = new BehaviorSubject<IUser | null>(aUser());
		uploadService = {
			getUserDocuments: jest.fn(() => of([pdf])),
			uploadPersonalPdf: jest.fn(() => of(undefined)),
			downloadSourceDocument: jest.fn(() => of(new Blob(['%PDF']))),
			deleteUserDocument: jest.fn(() => of(undefined)),
			reactivateUserDocument: jest.fn(() => of(undefined))
		};
		sourceRequestService = {
			getMyRequests: jest.fn(() => of([aSourceRequest()])),
			createRequest: jest.fn(() => of(aSourceRequest())),
			deleteRequest: jest.fn(() => of(undefined))
		};
		TestBed.configureTestingModule({
			imports: [CorpusComponent],
			providers: [
				provideTranslateService(),
				provideFakeIcons(),
				provideNotificationMock(notifications),
				provideDialogMock(dialog),
				// Sans transition (jsdom) : l'onglet choisi s'affiche aussitôt.
				{provide: MATERIAL_ANIMATIONS, useValue: {animationsDisabled: true}},
				{provide: AuthenticationServiceV2, useValue: {$authenticatedUser: user$}},
				{provide: UploadService, useValue: uploadService},
				{provide: SourceRequestService, useValue: sourceRequestService}
			]
		});
		TestBed.overrideComponent(CorpusComponent, {
			remove: {imports: [ObFileUploadComponent, OfficialSourcesBrowserComponent, SourceViewerPanelComponent]},
			add: {imports: [ObFileUploadStubComponent, OfficialSourcesBrowserStubComponent, SourceViewerPanelStubComponent]}
		});
	});

	afterEach(() => jest.useRealTimers());

	describe('chargement', () => {
		it('attend un utilisateur actif avant de charger documents et demandes', () => {
			user$.next(null);
			create();
			user$.next(aUser({status: 'PENDING_ACTIVATION'} as Partial<IUser>));

			expect(uploadService.getUserDocuments).not.toHaveBeenCalled();
			expect(sourceRequestService.getMyRequests).not.toHaveBeenCalled();

			user$.next(aUser());

			expect(uploadService.getUserDocuments).toHaveBeenCalledTimes(1);
			expect(sourceRequestService.getMyRequests).toHaveBeenCalledTimes(1);
		});

		it('affiche un état vide sans document', () => {
			uploadService.getUserDocuments.mockReturnValue(of([]));
			create();

			expect(text('.user-documents-section .empty-state p')).toEqual(['personal.documents.no.documents']);
		});

		it('affiche le chargement des documents, puis les documents', () => {
			const docs$ = new Subject<IPersonalDocument[]>();
			uploadService.getUserDocuments.mockReturnValue(docs$);
			create();

			expect(element().querySelector('.user-documents-section .loading-container')).not.toBeNull();

			docs$.next([pdf]);
			docs$.complete();
			refresh(fixture);

			expect(element().querySelector('.user-documents-section .loading-container')).toBeNull();
			expect(text('mat-card-title')).toEqual(['directive-avs.pdf']);
		});

		it('notifie l’échec du chargement des documents et des demandes', () => {
			uploadService.getUserDocuments.mockReturnValue(throwError(() => new Error('500')));
			sourceRequestService.getMyRequests.mockReturnValue(throwError(() => new Error('500')));
			create();

			expect(notifications.error).toHaveBeenCalledWith('personal.documents.load.error');
			expect(notifications.error).toHaveBeenCalledWith('sources.requests.load.error');
			expect(component.isLoadingDocuments).toBe(false);
			expect(component.isLoadingRequests).toBe(false);
		});

		it('recharge les documents à la demande', () => {
			create();

			element().querySelector<HTMLButtonElement>('.user-documents-section .section-header button')?.click();

			expect(uploadService.getUserDocuments).toHaveBeenCalledTimes(2);
		});
	});

	describe('documents personnels', () => {
		it('affiche le statut de traitement, la disponibilité et les actions de chaque document', () => {
			uploadService.getUserDocuments.mockReturnValue(
				of([
					aPersonalDocument({availabilityStatus: 'ACTIVE', timeToLiveInDays: 12}),
					aPersonalDocument({title: 'notes.docx', status: 'PENDING'}),
					aPersonalDocument({title: 'scan.pdf', status: 'FAILED', errorCode: 'OCR_FAILED'}),
					aPersonalDocument({title: 'ancien.pdf', availabilityStatus: 'ARCHIVED', timeToLiveInDays: 3})
				])
			);
			create();
			const [active, pending, failed, archived] = cards();

			expect(text('mat-card-title')).toEqual(['directive-avs.pdf', 'notes.docx', 'scan.pdf', 'ancien.pdf']);
			expect(text('.status-badge mat-chip')).toEqual([
				'personal.documents.status.processed',
				'personal.documents.status.pending',
				'personal.documents.status.failed',
				'personal.documents.status.processed'
			]);
			expect(failed.querySelector('.status-badge mat-chip')?.classList).toContain('status-failed');
			expect(text('.failed-reason', failed)).toEqual(['upload.errors.OCR_FAILED']);
			expect(text('.availability-info mat-chip', active)).toEqual(['personal.documents.availability.active']);
			expect(text('.ttl-info', active)).toEqual(['personal.documents.ttl.archival']);
			expect(text('.ttl-info', archived)).toEqual(['personal.documents.ttl.deletion']);
			expect(archived.querySelector('.availability-info mat-chip')?.classList).toContain('availability-archived');
			expect(archived.querySelector('.archived-warning')).not.toBeNull();
			expect(button(archived, 'personal.documents.reactivate.named')).not.toBeNull();
			expect(button(active, 'personal.documents.reactivate.named')).toBeNull();
			// Seuls les PDF s'ouvrent dans la visionneuse ; un document non traité ne s'ouvre ni ne se télécharge.
			expect(pending.querySelector('button.open-document')).toBeNull();
			expect(active.querySelector<HTMLButtonElement>('button.open-document')?.disabled).toBe(false);
			expect(failed.querySelector<HTMLButtonElement>('button.open-document')?.disabled).toBe(true);
			expect(button(pending, 'personal.documents.download.named')?.disabled).toBe(true);
		});

		it.each([
			['PENDING', 'status-pending'],
			['PROCESSED', 'status-processed'],
			['FAILED', 'status-failed'],
			[undefined, 'status-pending']
		])('associe le statut %s à la classe %s', (status, cssClass) => {
			create();

			expect(component.getDocumentStatusClass(status)).toBe(cssClass);
		});

		it('ouvre un PDF dans la visionneuse, chargé à la demande', () => {
			create();

			cards()[0].querySelector<HTMLButtonElement>('button.open-document')?.click();
			refresh(fixture);

			const target = viewer().target();
			expect(target?.kind === 'file' && target.title).toBe('directive-avs.pdf');
			expect(element().querySelector('zco-source-viewer-panel')).not.toBeNull();
			expect(element().querySelector('.corpus-container')?.hasAttribute('inert')).toBe(true);
			expect(uploadService.downloadSourceDocument).not.toHaveBeenCalled();

			if (target?.kind === 'file') target.load().subscribe();
			expect(uploadService.downloadSourceDocument).toHaveBeenCalledWith('directive-avs.pdf');
		});

		it('télécharge un document', () => {
			const createObjectURL = jest.fn(() => 'blob:doc');
			const revokeObjectURL = jest.fn();
			Object.assign(globalThis.URL, {createObjectURL, revokeObjectURL});
			const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
				expect(this.download).toBe('directive-avs.pdf');
				expect(this.href).toBe('blob:doc');
			});
			create();

			button(cards()[0], 'personal.documents.download.named')?.click();

			expect(uploadService.downloadSourceDocument).toHaveBeenCalledWith('directive-avs.pdf');
			expect(click).toHaveBeenCalledTimes(1);
			expect(revokeObjectURL).toHaveBeenCalledWith('blob:doc');
			click.mockRestore();
		});

		it('notifie l’échec du téléchargement', () => {
			uploadService.downloadSourceDocument.mockReturnValue(throwError(() => new Error('500')));
			create();

			button(cards()[0], 'personal.documents.download.named')?.click();

			expect(notifications.error).toHaveBeenCalledWith('personal.documents.download.error');
		});

		it('supprime un document, ferme la visionneuse qui l’affichait et recharge la liste', () => {
			create();
			component.openDocument(pdf);

			button(cards()[0], 'personal.documents.delete.named')?.click();

			expect(uploadService.deleteUserDocument).toHaveBeenCalledWith('directive-avs.pdf');
			expect(notifications.success).toHaveBeenCalledWith('personal.documents.delete.success');
			expect(viewer().isOpen()).toBe(false);
			expect(uploadService.getUserDocuments).toHaveBeenCalledTimes(2);
		});

		it('laisse ouverte la visionneuse d’un autre document supprimé', () => {
			create();
			component.openDocument(aPersonalDocument({title: 'autre.pdf'}));

			component.deleteDocument(pdf);

			expect(viewer().isOpen()).toBe(true);
		});

		it('notifie l’échec de la suppression', () => {
			uploadService.deleteUserDocument.mockReturnValue(throwError(() => new Error('500')));
			create();

			button(cards()[0], 'personal.documents.delete.named')?.click();

			expect(notifications.error).toHaveBeenCalledWith('personal.documents.delete.error');
			expect(uploadService.getUserDocuments).toHaveBeenCalledTimes(1);
		});

		it('réactive un document archivé', () => {
			uploadService.getUserDocuments.mockReturnValue(of([aPersonalDocument({availabilityStatus: 'ARCHIVED'})]));
			create();

			button(cards()[0], 'personal.documents.reactivate.named')?.click();

			expect(uploadService.reactivateUserDocument).toHaveBeenCalledWith('directive-avs.pdf');
			expect(notifications.success).toHaveBeenCalledWith('personal.documents.reactivate.success');
			expect(uploadService.getUserDocuments).toHaveBeenCalledTimes(2);
		});

		it('notifie l’échec de la réactivation', () => {
			uploadService.reactivateUserDocument.mockReturnValue(throwError(() => new Error('500')));
			create();

			component.reactivateDocument(pdf);

			expect(notifications.error).toHaveBeenCalledWith('personal.documents.reactivate.error');
		});
	});

	describe('envoi de documents', () => {
		it('liste les fichiers choisis avec leur taille, et permet d’en retirer', () => {
			create();
			expect(uploadButton().disabled).toBe(true);

			upload().choose(aFile('a.pdf', 2048), 'déjà-envoyé.pdf', aFile('b.pdf', 10_240));
			component.uploadPersonalDocument({type: ObEUploadEventType.UPLOADED, files: [aFile('ignoré.pdf')]});
			refresh(fixture);

			expect(text('.documents-list li')).toEqual(['a.pdf (2 KB)', 'b.pdf (10 KB)']);
			expect(uploadButton().disabled).toBe(false);

			element().querySelector<HTMLButtonElement>('.documents-list button')?.click();
			refresh(fixture);

			expect(text('.documents-list li')).toEqual(['b.pdf (10 KB)']);
			expect(component.getFileSizeInKB(undefined)).toBe(0);
		});

		it('ne fait rien sans fichier', () => {
			create();

			component.uploadDocuments();

			expect(uploadService.uploadPersonalPdf).not.toHaveBeenCalled();
		});

		it('envoie chaque fichier, vide la liste et recharge les documents', () => {
			create();
			const files = [aFile('a.pdf'), aFile('b.pdf')];
			upload().choose(...files);
			refresh(fixture);

			uploadButton().click();
			refresh(fixture);

			expect(uploadService.uploadPersonalPdf.mock.calls).toEqual([[files[0]], [files[1]]]);
			expect(notifications.success).toHaveBeenCalledWith('personal.documents.upload.success');
			expect(component.documentsToUpload).toEqual([]);
			expect(text('.upload-info-message')).toEqual(['personal.documents.upload.processing']);
			expect(uploadService.getUserDocuments).toHaveBeenCalledTimes(2);
		});

		it('garde dans la liste les fichiers refusés et notifie chaque cause', () => {
			uploadService.uploadPersonalPdf.mockImplementation((file: File) =>
				file.name === 'gros.pdf' ? throwError(() => new HttpErrorResponse({status: 413, error: {MESSAGE: 'FILE_TOO_LARGE'}})) : of(undefined)
			);
			create();
			upload().choose(aFile('gros.pdf'), aFile('ok.pdf'));

			component.uploadDocuments();

			expect(notifications.error).toHaveBeenCalledWith({message: 'upload.errors.FILE_TOO_LARGE', title: 'gros.pdf'});
			expect(notifications.success).toHaveBeenCalledWith('personal.documents.upload.success');
			expect(component.documentsToUpload.map(doc => doc.fileName)).toEqual(['gros.pdf']);
			expect(component.isUploading).toBe(false);
		});

		it('ne recharge rien si tous les envois échouent', () => {
			uploadService.uploadPersonalPdf.mockReturnValue(throwError(() => new Error('réseau')));
			create();
			upload().choose(aFile('a.pdf'));

			component.uploadDocuments();

			expect(notifications.error).toHaveBeenCalledWith({message: 'personal.documents.upload.error', title: 'a.pdf'});
			expect(notifications.success).not.toHaveBeenCalled();
			expect(uploadService.getUserDocuments).toHaveBeenCalledTimes(1);
			expect(component.documentsToUpload).toHaveLength(1);
		});

		it('rafraîchit les documents toutes les 30 s tant qu’un traitement est en cours', () => {
			jest.useFakeTimers();
			const pending = aPersonalDocument({status: 'PENDING'});
			uploadService.getUserDocuments
				.mockReturnValueOnce(of([]))
				.mockReturnValueOnce(of([pending]))
				.mockReturnValueOnce(of([pending]));
			create();
			upload().choose(aFile('a.pdf'));
			component.uploadDocuments();
			expect(uploadService.getUserDocuments).toHaveBeenCalledTimes(2);

			jest.advanceTimersByTime(30_000);
			expect(uploadService.getUserDocuments).toHaveBeenCalledTimes(3);
			expect(component.showUploadInfo).toBe(true);

			jest.advanceTimersByTime(30_000);
			expect(uploadService.getUserDocuments).toHaveBeenCalledTimes(4);
			expect(component.userDocuments).toEqual([pdf]);
			expect(component.showUploadInfo).toBe(false);

			jest.advanceTimersByTime(60_000);
			expect(uploadService.getUserDocuments).toHaveBeenCalledTimes(4);
		});
	});

	describe('demandes de sources', () => {
		it('liste mes demandes avec leur statut', async () => {
			sourceRequestService.getMyRequests.mockReturnValue(
				of([aSourceRequest({requesterUsername: 'u12345'}), aSourceRequest({id: 4, sourceName: 'Circulaires AI', status: SourceRequestStatus.INTEGRATED})])
			);
			create();
			await openRequestsTab();
			const requests = Array.from(element().querySelectorAll<HTMLElement>('mat-card.request-card'));

			expect(text('mat-card-title')).toEqual(['Directives LAMal', 'Circulaires AI']);
			expect(text('.request-instructions')).toEqual(['Ajouter les directives LAMal', 'Ajouter les directives LAMal']);
			expect(text('mat-card-subtitle span', requests[0])).toEqual(['· u12345']);
			expect(text('.status-badge mat-chip')).toEqual(['sources.status.waiting', 'sources.status.integrated']);
			// Une demande déjà intégrée ne peut plus être supprimée.
			expect(button(requests[0], 'sources.request.delete.named')?.disabled).toBe(false);
			expect(button(requests[1], 'sources.request.delete.named')?.disabled).toBe(true);
		});

		it('supprime une demande et recharge la liste', async () => {
			create();
			await openRequestsTab();

			button(element().querySelector<HTMLElement>('mat-card.request-card'), 'sources.request.delete.named')?.click();

			expect(sourceRequestService.deleteRequest).toHaveBeenCalledWith(3);
			expect(notifications.success).toHaveBeenCalledWith('sources.request.delete.success');
			expect(sourceRequestService.getMyRequests).toHaveBeenCalledTimes(2);
		});

		it('notifie l’échec de la suppression d’une demande, et ignore une demande sans identifiant', () => {
			sourceRequestService.deleteRequest.mockReturnValue(throwError(() => new Error('500')));
			create();

			component.deleteSourceRequest(aSourceRequest({id: undefined}));
			expect(sourceRequestService.deleteRequest).not.toHaveBeenCalled();

			component.deleteSourceRequest(aSourceRequest());
			expect(notifications.error).toHaveBeenCalledWith('sources.request.delete.error');
		});

		it('crée une demande depuis le dialogue', async () => {
			const request = {sourceName: 'Circulaires AI', description: 'Pour les rentes AI'};
			dialog.result = request;
			sourceRequestService.getMyRequests.mockReturnValue(of([]));
			create();
			await openRequestsTab();

			expect(text('.requests-section .empty-state p')).toEqual(['sources.requests.no.requests']);
			element().querySelector<HTMLButtonElement>('.requests-section .empty-state button')?.click();

			expect(dialog.open).toHaveBeenCalledWith(RequestSourceDialogComponent, {width: '600px'});
			expect(sourceRequestService.createRequest).toHaveBeenCalledWith(request);
			expect(notifications.success).toHaveBeenCalledWith('sources.request.create.success');
			expect(sourceRequestService.getMyRequests).toHaveBeenCalledTimes(2);
		});

		it('ne crée rien si le dialogue est annulé', () => {
			dialog.result = undefined;
			create();

			component.openRequestSourceDialog();

			expect(sourceRequestService.createRequest).not.toHaveBeenCalled();
		});

		it('notifie l’échec de la création d’une demande', () => {
			dialog.result = {sourceName: 'x', description: 'y'};
			sourceRequestService.createRequest.mockReturnValue(throwError(() => new Error('500')));
			create();

			component.openRequestSourceDialog();

			expect(notifications.error).toHaveBeenCalledWith('sources.request.create.error');
		});

		it.each([
			[SourceRequestStatus.WAITING, 'accent'],
			[SourceRequestStatus.PROCESSING, 'primary'],
			[SourceRequestStatus.INTEGRATED, 'success'],
			['INCONNU' as SourceRequestStatus, 'default']
		])('associe le statut %s à la couleur %s', (status, color) => {
			create();

			expect(component.getStatusColor(status)).toBe(color);
		});
	});
});
