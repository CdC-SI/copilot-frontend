import {ComponentFixture, TestBed} from '@angular/core/testing';
import {provideTranslateService} from '@ngx-translate/core';
import {ObExternalLinkDirective} from '@oblique/oblique';
import {of, throwError} from 'rxjs';
import {NotificationMock, notificationMock, provideNotificationMock} from '../../../../../testing/angular';
import {aSource} from '../../../../../testing/stream-events';
import {MessageSource} from '../../../model/chat-history';
import {UploadService} from '../../../services/upload.service';
import * as fileDownload from '../../../utils/file-download.utils';
import {SourceViewerStore} from '../../source-viewer/source-viewer.store';
import {SourceComponent} from './source.component';

describe('SourceComponent', () => {
	let fixture: ComponentFixture<SourceComponent>;
	let component: SourceComponent;
	let notifications: NotificationMock;
	let uploadService: {downloadSourceDocument: jest.Mock};
	const element = (): HTMLElement => fixture.nativeElement;
	const query = <T extends Element = HTMLElement>(selector: string): T | null => element().querySelector<T>(selector);

	const setup = (withViewer: boolean): void => {
		notifications = notificationMock();
		uploadService = {downloadSourceDocument: jest.fn(() => of(new Blob(['%PDF'])))};
		TestBed.configureTestingModule({
			imports: [SourceComponent],
			providers: [
				provideTranslateService(),
				provideNotificationMock(notifications),
				{provide: UploadService, useValue: uploadService},
				...(withViewer ? [SourceViewerStore] : [])
			]
		});
		// Décoration Oblique des liens externes (dépend du jeton WINDOW) : hors du périmètre testé.
		TestBed.overrideComponent(SourceComponent, {remove: {imports: [ObExternalLinkDirective]}});
		fixture = TestBed.createComponent(SourceComponent);
		component = fixture.componentInstance;
	};

	const render = (source: MessageSource, sources: MessageSource[] = []): void => {
		fixture.componentRef.setInput('source', source);
		fixture.componentRef.setInput('sources', sources);
		fixture.detectChanges();
	};

	beforeEach(() => {
		jest.spyOn(fileDownload, 'openOrDownloadBlob').mockImplementation(() => undefined);
	});

	afterEach(() => jest.restoreAllMocks());

	describe('avec le panneau des sources', () => {
		beforeEach(() => setup(true));

		it('ouvre la source dans le panneau avec les sources de la réponse', () => {
			const first = aSource({documentId: 'doc-1', citation: 1, link: 'docs/directive-avs.pdf'});
			const second = aSource({documentId: 'doc-2', citation: 2});
			render(first, [first, second]);
			const store = TestBed.inject(SourceViewerStore);

			const button = query<HTMLButtonElement>('button.source-open');
			expect(button?.textContent?.trim()).toBe('directive-avs.pdf');
			expect(button?.getAttribute('aria-pressed')).toBe('false');

			button?.click();
			fixture.detectChanges();

			expect(store.target()).toEqual({kind: 'source', source: first});
			expect(store.hasNext()).toBe(true);
			expect(button?.getAttribute('aria-pressed')).toBe('true');
			expect(button?.classList).toContain('viewed');
			expect(uploadService.downloadSourceDocument).not.toHaveBeenCalled();
		});

		it('rattache la source ouverte à sa réponse pour suivre ses nouvelles sources', () => {
			const first = aSource({documentId: 'doc-1', citation: 1});
			const second = aSource({documentId: 'doc-2', citation: 2});
			fixture.componentRef.setInput('owner', 'message-1');
			render(first, [first]);
			const store = TestBed.inject(SourceViewerStore);

			query<HTMLButtonElement>('button.source-open')?.click();
			store.syncSources('message-1', [first, second]);

			expect(store.position()).toEqual({current: 1, total: 2});
		});
		it('ouvre une source seule quand la liste des sources est vide', () => {
			const source = aSource({documentId: 'doc-1'});
			render(source);

			component.openInViewer(source);

			expect(TestBed.inject(SourceViewerStore).position()).toEqual({current: 1, total: 1});
		});

		it('n’indique pas comme affichée une autre citation du même document', () => {
			const source = aSource({documentId: 'doc-1', citation: 1});
			render(source);
			TestBed.inject(SourceViewerStore).open(aSource({documentId: 'doc-1', citation: 2}));

			expect(component.isViewed(source)).toBe(false);
		});

		it('libelle les sources URL et processus métier', () => {
			expect(component.label(aSource({type: 'URL', link: 'https://www.ahv-iv.ch/fr/Merkblätter'}))).toBe('ahv-iv.ch/fr/Merkbl%C3%A4tter');
			expect(component.label(aSource({type: 'BUSINESS_PROCESS', title: 'Affiliation', link: 'https://bpanda/p/1'}))).toBe('Affiliation');
			expect(component.label(aSource({type: 'BUSINESS_PROCESS', title: undefined, link: 'https://bpanda/p/1'}))).toBe('https://bpanda/p/1');
		});

		it('garde le téléchargement direct d’une source sans identifiant', () => {
			render(aSource({documentId: undefined, link: 'docs/memo.docx'}));

			expect(query('button.source-open')).toBeNull();
			query<HTMLButtonElement>('.source-title button')?.click();

			expect(uploadService.downloadSourceDocument).toHaveBeenCalledWith('docs/memo.docx');
			expect(fileDownload.openOrDownloadBlob).toHaveBeenCalledWith(expect.any(Blob), 'memo.docx');
		});
	});

	describe('sans panneau des sources', () => {
		beforeEach(() => setup(false));

		it('télécharge les fichiers et notifie un échec', () => {
			render(aSource({link: 'docs/directive-avs.pdf'}));
			expect(component.opensInViewer(component.source)).toBe(false);

			uploadService.downloadSourceDocument.mockReturnValue(throwError(() => new Error('500')));
			query<HTMLButtonElement>('.source-title button')?.click();

			expect(notifications.error).toHaveBeenCalledWith('sourceList.download.error');
		});

		it('ouvre les sources URL dans un nouvel onglet', () => {
			render(aSource({type: 'URL', link: 'https://www.ahv-iv.ch/fr/', documentId: 'chunk-1'}));

			const link = query<HTMLAnchorElement>('.source-title a');
			expect(link?.getAttribute('href')).toBe('https://www.ahv-iv.ch/fr/');
			expect(link?.textContent?.trim()).toBe('ahv-iv.ch/fr/');
		});

		it('affiche un processus métier avec ou sans lien', () => {
			render(aSource({type: 'BUSINESS_PROCESS', title: 'Affiliation', link: ''}));
			expect(query('.source-title a')).toBeNull();
			expect(query('.source-title')?.textContent?.trim()).toBe('Affiliation');

			render(aSource({type: 'BUSINESS_PROCESS', title: 'Affiliation', link: 'https://bpanda/p/1'}));
			expect(query('.source-title a')?.getAttribute('href')).toBe('https://bpanda/p/1');
		});

		it('affiche les métadonnées et la pastille de citation', () => {
			render(aSource({citation: 4, subsection: '2.1', pageNumber: '12', version: 'v2024'}));

			expect(query('.source-citation')?.textContent?.trim()).toBe('4');
			expect(query('.source-meta')?.textContent).toContain('2.1');
			expect(query('.source-meta')?.textContent).toContain('12');
			expect(query('.source-meta')?.textContent).toContain('v2024');
		});
	});
});
