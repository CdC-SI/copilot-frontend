import {Component, input} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {MAT_DIALOG_DATA} from '@angular/material/dialog';
import {By} from '@angular/platform-browser';
import {provideTranslateService} from '@ngx-translate/core';
import {ObExternalLinkDirective} from '@oblique/oblique';
import {MarkdownComponent} from 'ngx-markdown';
import {of, throwError} from 'rxjs';
import {aSourceFeedback, provideFakeIcons, refresh} from '../../../../testing/admin';
import {NotificationMock, notificationMock, provideNotificationMock} from '../../../../testing/angular';
import {FeedbackStatus, IDocumentFeedbackDetail} from '../../../shared/model/feedback';
import {FeedbackService} from '../../../shared/services/feedback.service';
import {UploadService} from '../../../shared/services/upload.service';
import * as fileDownload from '../../../shared/utils/file-download.utils';
import {FeedbackStatusSelectComponent} from '../feedback-status-select/feedback-status-select.component';
import {DocumentFeedbackDetailDialogComponent} from './document-feedback-detail-dialog.component';

@Component({selector: 'markdown', template: '{{ data() }}'})
class MarkdownStubComponent {
	readonly data = input<string>();
}

const aDocumentDetail = (detail: Partial<IDocumentFeedbackDetail> = {}): IDocumentFeedbackDetail => ({
	documentId: 'doc-1',
	documentTitle: 'directive-avs.pdf',
	neg: 1,
	pos: 1,
	statusCounts: {NEW: 1, TREATED: 1, OBSOLETE: 0},
	feedbacks: [
		aSourceFeedback({id: 11}),
		aSourceFeedback({id: 12, feedbackType: 'POSITIVE', status: 'TREATED', category: undefined, comment: undefined, answer: 'Voir **directive**.'})
	],
	...detail
});

describe('DocumentFeedbackDetailDialogComponent', () => {
	let fixture: ComponentFixture<DocumentFeedbackDetailDialogComponent>;
	let notifications: NotificationMock;
	let feedbackService: {updateSourceFeedbackStatus: jest.Mock};
	let uploadService: {downloadSourceDocument: jest.Mock};
	const element = (): HTMLElement => fixture.nativeElement;
	const text = (): string => element().textContent?.replace(/\s+/g, ' ') ?? '';
	const statusSelects = (): FeedbackStatusSelectComponent[] =>
		fixture.debugElement.queryAll(By.directive(FeedbackStatusSelectComponent)).map(debug => debug.componentInstance);

	const setup = (data: IDocumentFeedbackDetail): void => {
		notifications = notificationMock();
		TestBed.configureTestingModule({
			imports: [DocumentFeedbackDetailDialogComponent],
			providers: [
				provideTranslateService(),
				provideFakeIcons(),
				provideNotificationMock(notifications),
				{provide: MAT_DIALOG_DATA, useValue: data},
				{provide: FeedbackService, useValue: feedbackService},
				{provide: UploadService, useValue: uploadService}
			]
		});
		TestBed.overrideComponent(DocumentFeedbackDetailDialogComponent, {
			remove: {imports: [MarkdownComponent, ObExternalLinkDirective]},
			add: {imports: [MarkdownStubComponent]}
		});
		fixture = TestBed.createComponent(DocumentFeedbackDetailDialogComponent);
		refresh(fixture);
	};

	beforeEach(() => {
		jest.spyOn(fileDownload, 'openOrDownloadBlob').mockImplementation(() => undefined);
		feedbackService = {updateSourceFeedbackStatus: jest.fn((id: number, status: FeedbackStatus) => of(aSourceFeedback({id, status})))};
		uploadService = {downloadSourceDocument: jest.fn(() => of(new Blob(['%PDF'])))};
	});

	afterEach(() => jest.restoreAllMocks());

	it('affiche le document, ses compteurs et chaque feedback', () => {
		setup(aDocumentDetail());

		expect(element().querySelector('h2')?.textContent).toContain('directive-avs.pdf');
		expect(Array.from(element().querySelectorAll('.meta .chip')).map(chip => chip.textContent?.trim())).toEqual(['👎 1', '👍 1', 'Σ 2']);
		expect(element().querySelectorAll('mat-expansion-panel')).toHaveLength(2);
		expect(text()).toContain('feedback.category.WRONG_SOURCE');
		expect(text()).toContain('Directive obsolète');
		expect(text()).toContain('(no comment)');
		expect(Array.from(element().querySelectorAll('markdown')).map(markdown => markdown.textContent)).toEqual(['65 ans.', 'Voir **directive**.']);
	});

	it('télécharge le document', () => {
		setup(aDocumentDetail());

		element().querySelector<HTMLButtonElement>('.meta button')?.click();

		expect(uploadService.downloadSourceDocument).toHaveBeenCalledWith('directive-avs.pdf');
		expect(fileDownload.openOrDownloadBlob).toHaveBeenCalledWith(expect.any(Blob), 'directive-avs.pdf');
	});

	it('notifie un téléchargement en échec', () => {
		uploadService.downloadSourceDocument.mockReturnValue(throwError(() => new Error('404')));
		setup(aDocumentDetail());

		fixture.componentInstance.downloadFile();

		expect(notifications.error).toHaveBeenCalled();
		expect(fileDownload.openOrDownloadBlob).not.toHaveBeenCalled();
	});

	it('propose un lien pour une page web', () => {
		setup(aDocumentDetail({documentUrl: 'https://www.ahv-iv.ch/fr/', documentTitle: undefined}));

		expect(element().querySelector<HTMLAnchorElement>('.meta a')?.href).toBe('https://www.ahv-iv.ch/fr/');
		expect(element().querySelector('.meta button')).toBeNull();
		expect(element().querySelector('h2')?.textContent).toContain('doc-1');
	});

	it('met à jour le statut d’un feedback, ou le rétablit en cas d’échec', () => {
		const detail = aDocumentDetail();
		setup(detail);

		statusSelects()[0].statusChange.emit('TREATED');
		expect(feedbackService.updateSourceFeedbackStatus).toHaveBeenCalledWith(11, 'TREATED');
		expect(detail.feedbacks[0].status).toBe('TREATED');

		feedbackService.updateSourceFeedbackStatus.mockReturnValue(throwError(() => new Error('500')));
		statusSelects()[1].statusChange.emit('OBSOLETE');
		expect(detail.feedbacks[1].status).toBe('TREATED');
		expect(notifications.error).toHaveBeenCalledWith('admin.feedback.status.error');
	});
});
