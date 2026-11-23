import {Component, signal} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {provideTranslateService} from '@ngx-translate/core';
import {MarkdownComponent, provideMarkdown} from 'ngx-markdown';
import {MessageSource} from '../../model/chat-history';
import {aSource} from '../../../../testing/stream-events';
import {CitationsDirective} from './citations.directive';

@Component({
	template: `<markdown [data]="markdown()" [zcoCitations]="sources()" (citationSelected)="selected.push($event)" />`,
	imports: [MarkdownComponent, CitationsDirective]
})
class HostComponent {
	readonly markdown = signal('');
	readonly sources = signal<MessageSource[] | undefined>(undefined);
	readonly selected: number[] = [];
}

describe('CitationsDirective', () => {
	let fixture: ComponentFixture<HostComponent>;
	let host: HostComponent;
	const element = (): HTMLElement => fixture.nativeElement;
	const pills = (): HTMLButtonElement[] => Array.from(element().querySelectorAll('button.citation-pill'));
	const tooltip = (): HTMLElement | null => document.querySelector('.cdk-overlay-container [role="tooltip"]');

	const render = async (markdown: string, sources?: MessageSource[]): Promise<void> => {
		host.markdown.set(markdown);
		host.sources.set(sources);
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();
	};

	beforeEach(() => {
		TestBed.configureTestingModule({
			imports: [HostComponent],
			providers: [provideMarkdown(), provideTranslateService()]
		});
		fixture = TestBed.createComponent(HostComponent);
		host = fixture.componentInstance;
	});

	afterEach(() => fixture.destroy());

	it('remplace les marqueurs du texte par des pastilles, sans toucher au code', async () => {
		await render('Délai de 30 jours [^1][^2].\n\n`[^1]`\n\n```\n[^2]\n```', [aSource({citation: 1, link: 'guide.pdf'})]);

		expect(pills().map(pill => pill.textContent)).toEqual(['1', '2']);
		expect(element().querySelector('p')?.textContent).toBe('Délai de 30 jours 12.');
		expect(element().querySelector('p code')?.textContent).toBe('[^1]');
		expect(element().querySelector('pre')?.textContent).toContain('[^2]');
		expect(pills()[0].getAttribute('aria-label')).toBe('chat.citation.label');
		expect(pills()[1].getAttribute('aria-label')).toBe('chat.citation.unknown');
	});

	it('met à jour les libellés quand les sources arrivent', async () => {
		await render('Texte [^2]');
		expect(pills()[0].getAttribute('aria-label')).toBe('chat.citation.unknown');

		host.sources.set([aSource({citation: 2})]);
		fixture.detectChanges();
		expect(pills()[0].getAttribute('aria-label')).toBe('chat.citation.label');
	});

	it('réhydrate après un nouveau rendu (streaming)', async () => {
		await render('Début [^1]');
		await render('Début [^1] suite [^2]');
		expect(pills().map(pill => pill.textContent)).toEqual(['1', '2']);
	});

	it('émet le numéro au clic', async () => {
		await render('Texte [^3]');
		pills()[0].click();
		expect(host.selected).toEqual([3]);
	});

	it('affiche l’aperçu au survol et le ferme à la sortie ou par Échap', async () => {
		await render('Texte [^1]', [aSource({citation: 1, link: 'dossier/guide.pdf', pageNumber: '4', subsection: '2.1'})]);
		const pill = pills()[0];

		pill.dispatchEvent(new MouseEvent('mouseover', {bubbles: true}));
		fixture.detectChanges();
		expect(tooltip()?.textContent).toContain('guide.pdf');
		expect(tooltip()?.textContent).toContain('2.1');
		expect(pill.getAttribute('aria-describedby')).toBe(tooltip()?.id);

		pill.dispatchEvent(new MouseEvent('mouseout', {bubbles: true}));
		expect(tooltip()).toBeNull();
		expect(pill.hasAttribute('aria-describedby')).toBe(false);

		pill.dispatchEvent(new FocusEvent('focusin', {bubbles: true}));
		fixture.detectChanges();
		expect(tooltip()).not.toBeNull();
		pill.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));
		expect(tooltip()).toBeNull();
	});

	it('ignore les événements hors pastille', async () => {
		await render('Texte [^1]');
		element().querySelector('p')?.click();
		element()
			.querySelector('p')
			?.dispatchEvent(new MouseEvent('mouseover', {bubbles: true}));
		expect(host.selected).toEqual([]);
		expect(tooltip()).toBeNull();
	});
});
