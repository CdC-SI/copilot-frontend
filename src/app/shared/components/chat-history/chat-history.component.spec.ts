import {ApplicationRef, Component, input} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {MatIcon} from '@angular/material/icon';
import {provideTranslateService} from '@ngx-translate/core';
import {of} from 'rxjs';
import {aChatTitle} from '../../../../testing/fixtures';
import {ChatTitle} from '../../model/chat-history';
import {ConversationService} from '../../services/conversation.service';
import {ChatHistoryComponent} from './chat-history.component';

@Component({selector: 'mat-icon', template: ''})
class MatIconStubComponent {
	readonly svgIcon = input<string>();
}

describe('ChatHistoryComponent', () => {
	let fixture: ComponentFixture<ChatHistoryComponent>;
	let component: ChatHistoryComponent;
	let conversations: {deleteConversation: jest.Mock; renameConversation: jest.Mock};

	const now = new Date(2026, 0, 15, 14, 0);
	const titles = (): ChatTitle[] => [
		aChatTitle({conversationId: 'c1', title: 'Rentes', timestamp: new Date(2026, 0, 15, 9, 30), selected: true}),
		aChatTitle({conversationId: 'c2', title: 'Cotisations', timestamp: new Date(2026, 0, 14, 18, 0)}),
		aChatTitle({conversationId: 'c3', title: 'APG', timestamp: new Date(2025, 11, 1, 8, 0)})
	];
	const el = (): HTMLElement => fixture.nativeElement;
	const headings = (): string[] => Array.from(el().querySelectorAll('.history-group')).map(h => h.textContent.trim());
	const items = (): HTMLElement[] => Array.from(el().querySelectorAll<HTMLElement>('mat-list-item'));
	const buttons = (item: HTMLElement): HTMLButtonElement[] => Array.from(item.querySelectorAll('button'));
	const input_ = (): HTMLInputElement => el().querySelector('input');
	const render = (list: ChatTitle[] | null = titles()): void => {
		fixture.componentRef.setInput('titles', list);
		fixture.detectChanges();
	};

	beforeEach(() => {
		jest.useFakeTimers({now});
		conversations = {deleteConversation: jest.fn(() => of(undefined)), renameConversation: jest.fn(() => of(undefined))};
		TestBed.configureTestingModule({
			imports: [ChatHistoryComponent],
			providers: [provideTranslateService(), {provide: ConversationService, useValue: conversations}]
		});
		TestBed.overrideComponent(ChatHistoryComponent, {remove: {imports: [MatIcon]}, add: {imports: [MatIconStubComponent]}});
		fixture = TestBed.createComponent(ChatHistoryComponent);
		component = fixture.componentInstance;
	});

	afterEach(() => {
		fixture.destroy();
		jest.useRealTimers();
	});

	it('regroupe les conversations par période, avec l’heure seule pour les jours récents', () => {
		render();

		expect(headings()).toEqual(['chat.history.period.today', 'chat.history.period.yesterday', 'chat.history.period.older']);
		expect(items()[0].classList).toContain('title-selected');
		expect(items()[1].classList).toContain('title');
		expect(items()[0].querySelector('.history-item-date').textContent.trim()).toBe('09:30');
		expect(items()[2].querySelector('.history-item-date').textContent.trim()).toBe('1 Dec, 08:00');
	});

	it('n’affiche rien sans conversations', () => {
		render(null);

		expect(headings()).toEqual([]);
	});

	it('recalcule les périodes au minuit suivant', () => {
		render();

		jest.advanceTimersByTime(10 * 3600 * 1000 + 1000);
		fixture.detectChanges();

		expect(headings()).toEqual(['chat.history.period.yesterday', 'chat.history.period.last-7-days', 'chat.history.period.older']);
	});

	it('recalcule les périodes quand l’onglet redevient visible', () => {
		render();
		jest.setSystemTime(new Date(2026, 0, 16, 9, 0));
		const visibility = jest.spyOn(document, 'visibilityState', 'get');

		visibility.mockReturnValue('hidden');
		document.dispatchEvent(new Event('visibilitychange'));
		fixture.detectChanges();
		expect(headings()[0]).toBe('chat.history.period.today');

		visibility.mockReturnValue('visible');
		document.dispatchEvent(new Event('visibilitychange'));
		fixture.detectChanges();
		expect(headings()[0]).toBe('chat.history.period.yesterday');
		visibility.mockRestore();
	});

	it('sélectionne une conversation au clic', () => {
		render();
		const selected: ChatTitle[] = [];
		component.conversationSelected.subscribe(title => selected.push(title));

		items()[1].querySelector<HTMLElement>('.history-item-body').click();

		expect(selected.map(t => t.conversationId)).toEqual(['c2']);
	});

	it('supprime une conversation côté backend puis la signale, sans la sélectionner', () => {
		render();
		const deleted: ChatTitle[] = [];
		const selected = jest.fn();
		component.conversationDeleted.subscribe(title => deleted.push(title));
		component.conversationSelected.subscribe(selected);

		buttons(items()[0])[1].click();

		expect(conversations.deleteConversation).toHaveBeenCalledWith('c1');
		expect(deleted.map(t => t.conversationId)).toEqual(['c1']);
		expect(selected).not.toHaveBeenCalled();
	});

	describe('renommage', () => {
		let renamed: {conversationId: string; title: string}[];

		beforeEach(() => {
			render();
			renamed = [];
			component.conversationRenamed.subscribe(event => renamed.push(event));
			buttons(items()[0])[0].click();
			fixture.detectChanges();
		});

		const type = async (value: string): Promise<void> => {
			await Promise.resolve();
			input_().value = value;
			input_().dispatchEvent(new Event('input'));
		};

		it('ouvre un champ pré-rempli à la place du titre', async () => {
			await Promise.resolve();

			expect(input_().value).toBe('Rentes');
			expect(items()[0].querySelector('.history-item-body')).toBeNull();
		});

		it('donne au champ un nom accessible et le focus', async () => {
			await Promise.resolve();
			TestBed.inject(ApplicationRef).tick();

			expect(input_().getAttribute('aria-label')).toBe('chat.history.rename.label');
			expect(document.activeElement).toBe(input_());
		});

		it('enregistre le nouveau titre avec Entrée', async () => {
			await type('Rentes AVS');

			input_().dispatchEvent(new KeyboardEvent('keyup', {key: 'Enter'}));
			fixture.detectChanges();

			expect(conversations.renameConversation).toHaveBeenCalledWith('c1', 'Rentes AVS');
			expect(renamed).toEqual([{conversationId: 'c1', title: 'Rentes AVS'}]);
			expect(input_()).toBeNull();
		});

		it('ignore un titre vide ou inchangé', async () => {
			await type('   ');
			input_().dispatchEvent(new KeyboardEvent('keyup', {key: 'Enter'}));
			fixture.detectChanges();

			expect(conversations.renameConversation).not.toHaveBeenCalled();
			expect(input_()).toBeNull();

			component.editingTitle = component.groups[0].titles[0];
			component.tempTitle = 'Rentes';
			component.saveRename(component.groups[0].titles[0]);
			expect(conversations.renameConversation).not.toHaveBeenCalled();
			expect(component.editingTitle).toBeNull();
		});

		it('annule avec Échap ou en quittant le champ', () => {
			input_().dispatchEvent(new KeyboardEvent('keyup', {key: 'Escape'}));
			fixture.detectChanges();
			expect(input_()).toBeNull();

			buttons(items()[0])[0].click();
			fixture.detectChanges();
			input_().dispatchEvent(new FocusEvent('focusout'));
			fixture.detectChanges();
			expect(input_()).toBeNull();
		});

		it('un clic dans le champ ne sélectionne pas la conversation', () => {
			const selected = jest.fn();
			component.conversationSelected.subscribe(selected);

			input_().click();

			expect(selected).not.toHaveBeenCalled();
		});
	});
});
