import {ComponentFixture, TestBed} from '@angular/core/testing';
import {provideTranslateService} from '@ngx-translate/core';
import {aSource} from '../../../../testing/stream-events';
import {MessageSource} from '../../model/chat-history';
import {CitationCardComponent} from './citation-card.component';

describe('CitationCardComponent', () => {
	let fixture: ComponentFixture<CitationCardComponent>;

	const el = (): HTMLElement => fixture.nativeElement;
	const render = (n: number, source?: MessageSource): void => {
		fixture.componentRef.setInput('n', n);
		fixture.componentRef.setInput('source', source);
		fixture.componentRef.setInput('cardId', 'card-1');
		fixture.detectChanges();
	};

	beforeEach(() => {
		TestBed.configureTestingModule({imports: [CitationCardComponent], providers: [provideTranslateService()]});
		fixture = TestBed.createComponent(CitationCardComponent);
	});

	it('affiche le numéro, le libellé de la source et ses métadonnées', () => {
		render(2, aSource({link: 'directive-avs.pdf', subsection: 'Rentes', pageNumber: '12', version: 'v2'}));

		expect(el().querySelector('.citation-card').id).toBe('card-1');
		expect(el().querySelector('.citation-card-number').textContent).toBe('2');
		expect(el().querySelector('.citation-card-title').textContent).toContain('directive-avs');
		expect(Array.from(el().querySelectorAll('.citation-card-meta li')).map(li => li.textContent.trim())).toEqual([
			'sourceList.meta.section : Rentes',
			'sourceList.meta.page : 12',
			'sourceList.meta.version : v2'
		]);
		expect(el().querySelector('.citation-card-hint')).not.toBeNull();
	});

	it('omet les métadonnées absentes', () => {
		render(1, aSource({pageNumber: undefined}));

		expect(el().querySelector('.citation-card-meta')).toBeNull();
		expect(el().querySelector('.citation-card-hint')).not.toBeNull();
	});

	it('signale une citation sans source connue', () => {
		render(9);

		expect(el().querySelector('.citation-card-title').textContent).toContain('chat.citation.unknown');
		expect(el().querySelector('.citation-card-hint')).toBeNull();
	});
});
