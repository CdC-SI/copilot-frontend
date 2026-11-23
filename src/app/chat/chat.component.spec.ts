import {signal} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {MatDialog} from '@angular/material/dialog';
import {aSource} from '../../testing/stream-events';
import {SourceViewerStore} from '../shared/components/source-viewer/source-viewer.store';
import {UserAuthDialogService} from './services';
import {ChatComponent} from './chat.component';
import {ChatStore} from './chat.store';

/** Logique de la page (raccourcis, dépôt de fichiers), sans rendu du gabarit. */
describe('ChatComponent', () => {
	let component: ChatComponent;
	let viewer: SourceViewerStore;
	let dialog: {openDialogs: unknown[]};
	let chatStore: {
		currentConversation: ReturnType<typeof signal<{conversationId: string} | null>>;
		isGenerating: ReturnType<typeof signal<boolean>>;
		isStopping: ReturnType<typeof signal<boolean>>;
		stopGeneration: jest.Mock;
		addAttachments: jest.Mock;
	};

	const files = (...names: string[]): File[] => names.map(name => new File(['x'], name));
	const dragEvent = (dropped: File[] = []): DragEvent => ({preventDefault: jest.fn(), dataTransfer: {files: dropped}}) as unknown as DragEvent;

	beforeEach(() => {
		chatStore = {
			currentConversation: signal<{conversationId: string} | null>({conversationId: 'c-1'}),
			isGenerating: signal(false),
			isStopping: signal(false),
			stopGeneration: jest.fn(),
			addAttachments: jest.fn()
		};
		dialog = {openDialogs: []};
		TestBed.configureTestingModule({
			providers: [
				SourceViewerStore,
				{provide: ChatStore, useValue: chatStore},
				{provide: MatDialog, useValue: dialog},
				{provide: UserAuthDialogService, useValue: {}}
			]
		});
		viewer = TestBed.inject(SourceViewerStore);
		component = TestBed.runInInjectionContext(() => new ChatComponent());
		TestBed.tick();
	});

	describe('Échap', () => {
		it('ferme d’abord le panneau des sources, sans arrêter la génération', () => {
			chatStore.isGenerating.set(true);
			viewer.open(aSource({documentId: 'doc-1'}));

			component.onEscape();

			expect(viewer.isOpen()).toBe(false);
			expect(chatStore.stopGeneration).not.toHaveBeenCalled();
		});

		it('arrête la génération en cours quand le panneau est fermé', () => {
			chatStore.isGenerating.set(true);

			component.onEscape();

			expect(chatStore.stopGeneration).toHaveBeenCalledTimes(1);
		});

		it('ne fait rien pendant un arrêt en cours ou sans génération', () => {
			component.onEscape();
			chatStore.isGenerating.set(true);
			chatStore.isStopping.set(true);
			component.onEscape();

			expect(chatStore.stopGeneration).not.toHaveBeenCalled();
		});

		it('est ignoré quand une boîte de dialogue est ouverte', () => {
			dialog.openDialogs = [{}];
			chatStore.isGenerating.set(true);
			viewer.open(aSource({documentId: 'doc-1'}));

			component.onEscape();

			expect(viewer.isOpen()).toBe(true);
			expect(chatStore.stopGeneration).not.toHaveBeenCalled();
		});
	});

	it('ferme le panneau des sources au changement de conversation', () => {
		viewer.open(aSource({documentId: 'doc-1'}));
		TestBed.tick();
		expect(viewer.isOpen()).toBe(true);

		chatStore.currentConversation.set({conversationId: 'c-2'});
		TestBed.tick();

		expect(viewer.isOpen()).toBe(false);
	});

	it('ajoute les fichiers collés et ignore un collage sans fichier', () => {
		const pasted = files('note.pdf');
		const paste = {preventDefault: jest.fn(), clipboardData: {files: pasted}} as unknown as ClipboardEvent;
		component.onPaste(paste);
		expect(paste.preventDefault).toHaveBeenCalled();
		expect(chatStore.addAttachments).toHaveBeenCalledWith(pasted);

		const text = {preventDefault: jest.fn(), clipboardData: {files: []}} as unknown as ClipboardEvent;
		component.onPaste(text);
		expect(text.preventDefault).not.toHaveBeenCalled();
		expect(chatStore.addAttachments).toHaveBeenCalledTimes(1);
	});

	it('signale le survol d’un glisser-déposer et ajoute les fichiers déposés', () => {
		component.onDragOver(dragEvent());
		expect(component.isDragOver()).toBe(true);
		component.onDragLeave(dragEvent());
		expect(component.isDragOver()).toBe(false);

		const dropped = files('a.pdf', 'b.docx');
		component.onDragOver(dragEvent());
		component.onDrop(dragEvent(dropped));

		expect(component.isDragOver()).toBe(false);
		expect(chatStore.addAttachments).toHaveBeenCalledWith(dropped);
		component.onDrop(dragEvent());
		expect(chatStore.addAttachments).toHaveBeenCalledTimes(1);
	});
});
