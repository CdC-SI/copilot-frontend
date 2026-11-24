import {ComponentFixture, TestBed} from '@angular/core/testing';
import {Component, input} from '@angular/core';
import {provideTranslateService} from '@ngx-translate/core';
import {Subject, of, throwError} from 'rxjs';
import {NotificationMock, notificationMock, provideNotificationMock} from '../../../../testing/angular';
import {aSource} from '../../../../testing/stream-events';
import {MessageSource} from '../../model/chat-history';
import {ChatMessage, ChatMessageSource} from '../../model/chat-message';
import {AuthenticationServiceV2} from '../../services/auth.service';
import {FeedbackService} from '../../services/feedback.service';
import {SourceComponent} from './source/source.component';
import {SourceListComponent} from './source-list.component';

@Component({selector: 'zco-source', template: '{{ source().link }}'})
class SourceStubComponent {
	readonly source = input<MessageSource>();
	readonly sources = input<MessageSource[]>();
	readonly owner = input<string>();
}

describe('SourceListComponent', () => {
	let fixture: ComponentFixture<SourceListComponent>;
	let component: SourceListComponent;
	let notif: NotificationMock;
	let feedback: {sendSourceFeedback: jest.Mock; getMySourceFeedbacks: jest.Mock};
	let expert: boolean;

	const message = (sources: MessageSource[]): ChatMessage => ({
		clientId: 'cli-1',
		id: 'a1',
		message: 'Réponse',
		source: ChatMessageSource.LLM,
		timestamp: new Date(),
		isCompleted: true,
		sources
	});
	const el = (): HTMLElement => fixture.nativeElement;
	const cards = () => Array.from(el().querySelectorAll<HTMLElement>('.source-card'));
	const dialog = () => el().querySelector<HTMLDialogElement>('dialog');

	const render = (sources: MessageSource[], inputs: Partial<{expanded: boolean; highlightedCitation: number}> = {}): void => {
		fixture.componentRef.setInput('message', message(sources));
		fixture.componentRef.setInput('conversationId', 'c1');
		fixture.componentRef.setInput('question', 'Question ?');
		Object.entries(inputs).forEach(([key, value]) => fixture.componentRef.setInput(key, value));
		fixture.detectChanges();
	};

	beforeEach(() => {
		expert = true;
		notif = notificationMock();
		feedback = {sendSourceFeedback: jest.fn(() => of(undefined)), getMySourceFeedbacks: jest.fn(() => of([]))};
		// jsdom n'implémente pas les dialogues modaux natifs.
		HTMLDialogElement.prototype.showModal = jest.fn(function (this: HTMLDialogElement) {
			this.setAttribute('open', '');
		});
		HTMLDialogElement.prototype.close = jest.fn(function (this: HTMLDialogElement) {
			this.removeAttribute('open');
			this.dispatchEvent(new Event('close'));
		});
		TestBed.configureTestingModule({
			imports: [SourceListComponent],
			providers: [
				provideTranslateService(),
				provideNotificationMock(notif),
				{provide: FeedbackService, useValue: feedback},
				{provide: AuthenticationServiceV2, useValue: {hasExpertRole: () => expert}}
			]
		});
		TestBed.overrideComponent(SourceListComponent, {remove: {imports: [SourceComponent]}, add: {imports: [SourceStubComponent]}});
		fixture = TestBed.createComponent(SourceListComponent);
		component = fixture.componentInstance;
	});

	it('n’affiche rien sans source', () => {
		render([]);

		expect(el().querySelector('.source-list')).toBeNull();
	});

	it('affiche les sources citées d’abord, dans l’ordre des numéros, et met en évidence la citation demandée', () => {
		render([aSource({link: 'libre.pdf', documentId: 'u'}), aSource({link: 'deux.pdf', citation: 2}), aSource({link: 'un.pdf', citation: 1})], {
			highlightedCitation: 2
		});

		expect(cards().map(card => card.querySelector('zco-source').textContent.trim())).toEqual(['un.pdf', 'deux.pdf', 'libre.pdf']);
		expect(cards().map(card => card.classList.contains('highlighted'))).toEqual([false, true, false]);
		expect(cards()[1].dataset['citationSource']).toBe('2');
	});

	it('réserve le vote sur les sources aux experts', () => {
		expert = false;
		render([aSource()]);

		expect(el().querySelector('.source-actions')).toBeNull();
	});

	describe('vote', () => {
		const source = aSource({documentId: 'doc-1', link: 'docs/directive.pdf'});

		it('ouvre le dialogue de vote négatif, catégorie « mauvaise source »', () => {
			render([source]);

			el().querySelector<HTMLButtonElement>('button.downvote').click();
			fixture.detectChanges();

			expect(dialog().open).toBe(true);
			expect(component.selectedCategory).toBe('WRONG_SOURCE');
			expect(component.isEditing).toBe(false);
			expect(el().querySelector('.dialog-subtitle').textContent.trim()).toBe('directive.pdf');
		});

		it('enregistre le vote et le commentaire, puis affiche la pastille', () => {
			render([source]);
			component.openFeedback(source, 'upvote');
			component.comment = '  Utile  ';

			component.submitFeedback(new Event('submit'));
			fixture.detectChanges();

			expect(feedback.sendSourceFeedback).toHaveBeenCalledWith({
				conversationId: 'c1',
				messageId: 'a1',
				documentId: 'doc-1',
				isPositive: true,
				comment: 'Utile',
				question: 'Question ?',
				answer: 'Réponse',
				category: undefined
			});
			expect(notif.success).toHaveBeenCalledWith('feedback.success');
			expect(dialog().open).toBe(false);
			expect(component.selectedSource).toBeNull();
			expect(el().querySelector('button.upvote').classList).toContain('active');
			expect(el().querySelector('.vote-chip')).not.toBeNull();
		});

		it('reste ouvert et notifie en cas d’échec', () => {
			feedback.sendSourceFeedback.mockReturnValue(throwError(() => new Error('KO')));
			render([source]);
			component.openFeedback(source, 'downvote');

			component.submitFeedback(new Event('submit'));

			expect(notif.error).toHaveBeenCalledWith('feedback.error');
			expect(component.isSubmitting).toBe(false);
			expect(dialog().open).toBe(true);
		});

		it('désactive l’envoi pendant la requête', () => {
			feedback.sendSourceFeedback.mockReturnValue(new Subject());
			render([source]);
			el().querySelector<HTMLButtonElement>('button.upvote').click();

			el().querySelector('form').dispatchEvent(new Event('submit'));
			fixture.detectChanges();

			expect(el().querySelector<HTMLButtonElement>('button[type=submit]').disabled).toBe(true);
		});

		it('n’envoie rien sans source sélectionnée', () => {
			render([source]);

			component.submitFeedback(new Event('submit'));

			expect(feedback.sendSourceFeedback).not.toHaveBeenCalled();
		});
	});

	describe('retours existants', () => {
		it('sont chargés au premier déploiement et préremplissent le dialogue en modification', () => {
			feedback.getMySourceFeedbacks.mockReturnValue(
				of([
					{documentId: 'doc-1', isPositive: false, comment: 'Obsolète', category: 'WRONG_SOURCE'},
					{documentId: null, isPositive: true}
				])
			);
			const source = aSource({documentId: 'doc-1'});
			render([source], {expanded: true});
			fixture.componentRef.setInput('expanded', false);
			fixture.componentRef.setInput('expanded', true);
			fixture.detectChanges();

			expect(feedback.getMySourceFeedbacks).toHaveBeenCalledTimes(1);
			expect(feedback.getMySourceFeedbacks).toHaveBeenCalledWith('c1', 'a1');
			expect(el().querySelector('button.downvote').classList).toContain('active');

			component.openFeedback(source, 'upvote');
			expect(component.isEditing).toBe(true);
			expect(component.previousVote).toBe('downvote');
			expect(component.comment).toBe('Obsolète');
		});

		it('ne sont pas chargés pour un non-expert', () => {
			expert = false;

			render([aSource()], {expanded: true});

			expect(feedback.getMySourceFeedbacks).not.toHaveBeenCalled();
		});

		it('avertissent sans bloquer en cas d’échec', () => {
			feedback.getMySourceFeedbacks.mockReturnValue(throwError(() => new Error('KO')));

			render([aSource()], {expanded: true});

			expect(notif.warning).toHaveBeenCalled();
		});
	});

	it('libelle les URL et les fichiers', () => {
		expect(component.extractLabel('https://www.ahv-iv.ch/fr/rentes')).toBe('ahv-iv.ch/fr/rentes');
		expect(component.extractLabel('pas une url')).toBe('pas une url');
		expect(component.fileName('a/b/c.pdf')).toBe('c.pdf');
		expect(component.isUrl(aSource({type: 'URL'}))).toBe(true);
		expect(component.sourceKey(aSource({citation: 3}), 0)).toBe('c3');
		expect(component.sourceKey(aSource({documentId: 'd'}), 2)).toBe('u2|d');
	});
});
