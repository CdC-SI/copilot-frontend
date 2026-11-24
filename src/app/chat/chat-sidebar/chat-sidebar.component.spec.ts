import {Component, EventEmitter, Input, Output, signal} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {MatIcon} from '@angular/material/icon';
import {By} from '@angular/platform-browser';
import {provideTranslateService} from '@ngx-translate/core';
import {aChatTitle} from '../../../testing/fixtures';
import {ChatHistoryComponent} from '../../shared/components/chat-history/chat-history.component';
import {ChatTitle} from '../../shared/model/chat-history';
import {ChatStore} from '../chat.store';
import {ChatSidebarComponent} from './chat-sidebar.component';

@Component({selector: 'mat-icon', template: ''})
class MatIconStubComponent {
	@Input() svgIcon: string;
}

@Component({selector: 'zco-chat-history', template: ''})
class ChatHistoryStubComponent {
	@Input() titles: ChatTitle[];
	@Output() readonly conversationSelected = new EventEmitter<ChatTitle>();
	@Output() readonly conversationDeleted = new EventEmitter<ChatTitle>();
	@Output() readonly conversationRenamed = new EventEmitter<{conversationId: string; title: string}>();
}

describe('ChatSidebarComponent', () => {
	let fixture: ComponentFixture<ChatSidebarComponent>;
	const titles = [aChatTitle()];
	const store = {
		isRegistered: signal(true),
		conversationTitles: signal(titles),
		newChat: jest.fn(),
		selectConversation: jest.fn(),
		deleteConversation: jest.fn(),
		renameConversation: jest.fn()
	};
	const history = (): ChatHistoryStubComponent =>
		fixture.debugElement.query(By.directive(ChatHistoryStubComponent))?.componentInstance as ChatHistoryStubComponent;

	beforeEach(() => {
		store.isRegistered.set(true);
		TestBed.configureTestingModule({imports: [ChatSidebarComponent], providers: [provideTranslateService(), {provide: ChatStore, useValue: store}]});
		TestBed.overrideComponent(ChatSidebarComponent, {
			remove: {imports: [MatIcon, ChatHistoryComponent]},
			add: {imports: [MatIconStubComponent, ChatHistoryStubComponent]}
		});
		fixture = TestBed.createComponent(ChatSidebarComponent);
		fixture.detectChanges();
	});

	it('démarre une nouvelle conversation', () => {
		fixture.nativeElement.querySelector('button').click();

		expect(store.newChat).toHaveBeenCalled();
	});

	it('affiche l’historique et relaie ses événements vers le store', () => {
		const rename = {conversationId: 'c1', title: 'Nouveau'};
		history().conversationSelected.emit(titles[0]);
		history().conversationDeleted.emit(titles[0]);
		history().conversationRenamed.emit(rename);

		expect(history().titles).toBe(titles);
		expect(store.selectConversation).toHaveBeenCalledWith(titles[0]);
		expect(store.deleteConversation).toHaveBeenCalledWith(titles[0]);
		expect(store.renameConversation).toHaveBeenCalledWith(rename);
	});

	it('masque l’historique aux utilisateurs non inscrits', () => {
		store.isRegistered.set(false);
		fixture.detectChanges();

		expect(history()).toBeUndefined();
	});
});
