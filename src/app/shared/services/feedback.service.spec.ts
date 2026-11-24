import {HttpTestingController} from '@angular/common/http/testing';
import {TestBed} from '@angular/core/testing';
import {Observable} from 'rxjs';
import {TEST_API, provideApiTesting} from '../../../testing/angular';
import {FeedbackService} from './feedback.service';

describe('FeedbackService', () => {
	let service: FeedbackService;
	let http: HttpTestingController;

	beforeEach(() => {
		TestBed.configureTestingModule({providers: provideApiTesting()});
		service = TestBed.inject(FeedbackService);
		http = TestBed.inject(HttpTestingController);
	});

	afterEach(() => http.verify());

	it('lit les statistiques sur 30 jours par défaut', () => {
		service.stats().subscribe();

		http.expectOne(`${TEST_API}/feedback/stats?range=30d`).flush({});
	});

	describe('listes', () => {
		it('demandent les détails des messages par défaut', () => {
			service.listMessageFeedback().subscribe();

			http.expectOne(`${TEST_API}/feedback/messages?range=30d&includeDetails=true`).flush([]);
		});

		it('filtrent les messages par statut et catégorie, sans détails', () => {
			service.listMessageFeedback('7d', false, 'NEW', 'WRONG' as never).subscribe();

			http.expectOne(`${TEST_API}/feedback/messages?range=7d&status=NEW&category=WRONG`).flush([]);
		});

		it('filtrent les sources par statut et catégorie', () => {
			service.listSourceFeedback('all', 'DONE' as never, 'OUTDATED' as never).subscribe();

			http.expectOne(`${TEST_API}/feedback/sources?range=all&status=DONE&category=OUTDATED`).flush([]);
		});

		it('listent les sources sans filtre', () => {
			service.listSourceFeedback().subscribe();

			http.expectOne(`${TEST_API}/feedback/sources?range=30d`).flush([]);
		});
	});

	describe('compteur des nouveaux retours', () => {
		const flushNew = (messages: number, sources: number) => {
			http.expectOne(`${TEST_API}/feedback/messages?range=all&status=NEW`).flush(Array(messages).fill({}));
			http.expectOne(`${TEST_API}/feedback/sources?range=all&status=NEW`).flush(Array(sources).fill({}));
		};

		it('additionne les messages et les sources', () => {
			service.refreshNewFeedbackCount();
			flushNew(2, 3);

			expect(service.newFeedbackCount$.getValue()).toBe(5);
		});

		it('garde la valeur précédente en cas d’échec', () => {
			service.newFeedbackCount$.next(4);

			service.refreshNewFeedbackCount();
			http.expectOne(`${TEST_API}/feedback/messages?range=all&status=NEW`).flush(null, {status: 500, statusText: 'KO'});
			http.expectOne(`${TEST_API}/feedback/sources?range=all&status=NEW`);

			expect(service.newFeedbackCount$.getValue()).toBe(4);
		});

		it.each<[string, (s: FeedbackService) => Observable<unknown>]>([
			['messages', (s: FeedbackService) => s.updateMessageFeedbackStatus(1, 'DONE' as never)],
			['sources', (s: FeedbackService) => s.updateSourceFeedbackStatus(1, 'DONE' as never)]
		])('est rafraîchi après un changement de statut (%s)', (kind, update) => {
			update(service).subscribe();

			const request = http.expectOne(`${TEST_API}/feedback/${kind}/1/status`);
			expect(request.request.method).toBe('PATCH');
			expect(request.request.body).toEqual({status: 'DONE'});
			request.flush({});
			flushNew(1, 0);

			expect(service.newFeedbackCount$.getValue()).toBe(1);
		});
	});

	it('envoie les retours sur une réponse et sur une source', () => {
		service.sendAnswerFeedback({} as never).subscribe();
		service.sendSourceFeedback({} as never).subscribe();

		expect(http.expectOne(`${TEST_API}/conversations/feedbacks?type=answer`).request.method).toBe('POST');
		expect(http.expectOne(`${TEST_API}/conversations/feedbacks?type=source`).request.method).toBe('POST');
	});

	it('lit et met à jour la configuration du rapport', () => {
		service.getReportConfig().subscribe();
		service.updateReportConfig({} as never).subscribe();

		const [read, update] = http.match(`${TEST_API}/feedback/report-config`);
		expect(read.request.method).toBe('GET');
		expect(update.request.method).toBe('PUT');
	});

	it('lit mes retours sur les sources d’une réponse', () => {
		service.getMySourceFeedbacks('c1', 'm1').subscribe();

		http.expectOne(`${TEST_API}/conversations/feedbacks?type=source&conversationId=c1&messageId=m1`).flush([]);
	});
});
