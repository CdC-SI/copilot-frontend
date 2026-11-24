import {Component, input} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {MAT_DIALOG_DATA} from '@angular/material/dialog';
import {By} from '@angular/platform-browser';
import {provideTranslateService} from '@ngx-translate/core';
import {MarkdownComponent} from 'ngx-markdown';
import {of, throwError} from 'rxjs';
import {aMessageFeedback, provideFakeIcons, refresh} from '../../../../testing/admin';
import {NotificationMock, notificationMock, provideNotificationMock} from '../../../../testing/angular';
import {aSource} from '../../../../testing/stream-events';
import {SourceComponent} from '../../../shared/components/source-list/source/source.component';
import {IMessageFeedback} from '../../../shared/model/feedback';
import {FeedbackService} from '../../../shared/services/feedback.service';
import {FeedbackStatusSelectComponent} from '../feedback-status-select/feedback-status-select.component';
import {FeedbackDetailDialogComponent} from './feedback-detail-dialog.component';

@Component({selector: 'markdown', template: '{{ data() }}'})
class MarkdownStubComponent {
	readonly data = input<string>();
}

@Component({selector: 'zco-source', template: ''})
class SourceStubComponent {
	readonly source = input<unknown>();
}

const withSources = (feedback: Partial<IMessageFeedback> = {}): IMessageFeedback =>
	aMessageFeedback({sources: [aSource({documentId: 'doc-1'}), aSource({documentId: 'doc-2'})], ...feedback});

describe('FeedbackDetailDialogComponent', () => {
	let fixture: ComponentFixture<FeedbackDetailDialogComponent>;
	let notifications: NotificationMock;
	let feedbackService: {updateMessageFeedbackStatus: jest.Mock};
	const element = (): HTMLElement => fixture.nativeElement;
	const text = (): string => element().textContent?.replace(/\s+/g, ' ') ?? '';
	const statusSelect = (): FeedbackStatusSelectComponent => fixture.debugElement.query(By.directive(FeedbackStatusSelectComponent)).componentInstance;

	const setup = (data: IMessageFeedback): void => {
		notifications = notificationMock();
		TestBed.configureTestingModule({
			imports: [FeedbackDetailDialogComponent],
			providers: [
				provideTranslateService(),
				provideFakeIcons(),
				provideNotificationMock(notifications),
				{provide: MAT_DIALOG_DATA, useValue: data},
				{provide: FeedbackService, useValue: feedbackService}
			]
		});
		TestBed.overrideComponent(FeedbackDetailDialogComponent, {
			remove: {imports: [MarkdownComponent, SourceComponent]},
			add: {imports: [MarkdownStubComponent, SourceStubComponent]}
		});
		fixture = TestBed.createComponent(FeedbackDetailDialogComponent);
		refresh(fixture);
	};

	beforeEach(() => {
		feedbackService = {
			updateMessageFeedbackStatus: jest.fn((id: number, status: string) => of(aMessageFeedback({id, status: status as IMessageFeedback['status']})))
		};
	});

	it('affiche le feedback, la réponse et ses sources', () => {
		setup(withSources());

		expect(text()).toContain('2026-01-15 10:00');
		expect(element().querySelector('.neg')?.textContent).toBe('👎');
		expect(text()).toContain('feedback.category.INCOMPLETE_ANSWER');
		expect(text()).toContain('Il manque la LPP');
		expect(text()).toContain('Quel est l’âge de la retraite ?');
		expect(element().querySelector('markdown')?.textContent).toBe('L’âge de référence est de **65 ans**.');
		expect(element().querySelectorAll('zco-source')).toHaveLength(2);
	});

	it('n’affiche ni catégorie, ni commentaire, ni sources absents', () => {
		setup(aMessageFeedback({score: 1, category: undefined, comment: undefined, sources: []}));

		expect(element().querySelector('.pos')?.textContent).toBe('👍');
		expect(text()).not.toContain('category');
		expect(text()).not.toContain('comment');
		expect(element().querySelector('.source-list')).toBeNull();
	});

	it('met à jour le statut', () => {
		const data = aMessageFeedback();
		setup(data);

		statusSelect().statusChange.emit('TREATED');

		expect(feedbackService.updateMessageFeedbackStatus).toHaveBeenCalledWith(7, 'TREATED');
		expect(data.status).toBe('TREATED');
	});

	it('rétablit le statut précédent si la mise à jour échoue', () => {
		feedbackService.updateMessageFeedbackStatus.mockReturnValue(throwError(() => new Error('500')));
		const data = aMessageFeedback({status: 'TREATED'});
		setup(data);

		statusSelect().statusChange.emit('OBSOLETE');

		expect(data.status).toBe('TREATED');
		expect(notifications.error).toHaveBeenCalledWith('admin.feedback.status.error');
	});
});
