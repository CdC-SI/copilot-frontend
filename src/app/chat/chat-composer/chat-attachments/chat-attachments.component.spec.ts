import {Component, Input, signal} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {MatIcon} from '@angular/material/icon';
import {provideTranslateService} from '@ngx-translate/core';
import {Attachment} from '../../../shared/model/chat-history';
import {ChatStore} from '../../chat.store';
import {ChatAttachmentsComponent} from './chat-attachments.component';

@Component({selector: 'mat-icon', template: ''})
class MatIconStubComponent {
	@Input() svgIcon: string;
}

describe('ChatAttachmentsComponent', () => {
	let fixture: ComponentFixture<ChatAttachmentsComponent>;
	let component: ChatAttachmentsComponent;
	let store: {
		attachments: ReturnType<typeof signal<Attachment[]>>;
		attachmentsPollingTimedOut: ReturnType<typeof signal<boolean>>;
		downloadAttachment: jest.Mock;
		retryAttachment: jest.Mock;
		removeAttachment: jest.Mock;
		refreshAttachmentsStatus: jest.Mock;
	};

	const file = new File(['x'], 'a.pdf');
	const el = (): HTMLElement => fixture.nativeElement;
	const chips = (): HTMLElement[] => Array.from(el().querySelectorAll<HTMLElement>('mat-chip'));
	const render = (attachments: Attachment[]): void => {
		store.attachments.set(attachments);
		fixture.detectChanges();
	};

	beforeEach(() => {
		store = {
			attachments: signal<Attachment[]>([]),
			attachmentsPollingTimedOut: signal(false),
			downloadAttachment: jest.fn(),
			retryAttachment: jest.fn(),
			removeAttachment: jest.fn(),
			refreshAttachmentsStatus: jest.fn()
		};
		TestBed.configureTestingModule({imports: [ChatAttachmentsComponent], providers: [provideTranslateService(), {provide: ChatStore, useValue: store}]});
		TestBed.overrideComponent(ChatAttachmentsComponent, {remove: {imports: [MatIcon]}, add: {imports: [MatIconStubComponent]}});
		fixture = TestBed.createComponent(ChatAttachmentsComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('n’affiche rien sans pièce jointe', () => {
		expect(el().querySelector('.attachments-container')).toBeNull();
	});

	it('affiche l’envoi en cours sans bouton de suppression', () => {
		render([{fileName: 'a.pdf', file, isUploading: true}]);

		expect(chips()[0].classList).toContain('uploading');
		expect(chips()[0].querySelector('.upload-status').textContent).toBe('attachment.uploading');
		expect(chips()[0].querySelector('[matChipRemove]')).toBeNull();
	});

	it('affiche la taille d’une pièce jointe traitée et la télécharge au clic, à Entrée ou à Espace', () => {
		const processed: Attachment = {id: 1, fileName: 'b.pdf', fileSize: 12_345, status: 'PROCESSED'};
		render([processed]);

		chips()[0].click();
		chips()[0].dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter'}));
		chips()[0].dispatchEvent(new KeyboardEvent('keydown', {key: ' '}));

		expect(chips()[0].classList).toContain('downloadable');
		expect(chips()[0].querySelector('.attachment-size').textContent.trim()).toBe('(12 Ko)');
		expect(store.downloadAttachment).toHaveBeenCalledTimes(3);
		expect(store.downloadAttachment).toHaveBeenCalledWith(processed);
	});

	it('ne télécharge pas une pièce jointe non traitée', () => {
		render([{id: 2, fileName: 'c.pdf', status: 'PENDING'}]);

		chips()[0].click();

		expect(store.downloadAttachment).not.toHaveBeenCalled();
	});

	it('supprime une pièce jointe sans la télécharger', () => {
		render([{id: 3, fileName: 'd.pdf', status: 'PROCESSED'}]);

		chips()[0].querySelector<HTMLButtonElement>('[matChipRemove]').click();

		expect(store.removeAttachment).toHaveBeenCalledWith(3);
		expect(store.downloadAttachment).not.toHaveBeenCalled();
	});

	it('affiche la cause de l’échec et propose un nouvel essai si renvoyer le fichier peut réussir', () => {
		const failed: Attachment = {id: 4, fileName: 'e.pdf', file, status: 'FAILED', errorCode: 'UPLOAD_FAILED'};
		render([failed, {id: 5, fileName: 'f.pdf', file, status: 'FAILED', errorCode: 'FILE_TOO_LARGE'}, {id: 6, fileName: 'g.pdf', status: 'FAILED'}]);

		expect(chips().map(chip => chip.querySelector('.failed-status').textContent)).toEqual([
			'upload.errors.UPLOAD_FAILED',
			'upload.errors.FILE_TOO_LARGE',
			'attachment.failed'
		]);
		expect(chips().map(chip => !!chip.querySelector('.retry-button'))).toEqual([true, false, false]);

		chips()[0].querySelector<HTMLButtonElement>('.retry-button').click();
		expect(store.retryAttachment).toHaveBeenCalledWith(failed);
		expect(store.downloadAttachment).not.toHaveBeenCalled();
	});

	it('propose d’actualiser quand le suivi du traitement a expiré', () => {
		store.attachmentsPollingTimedOut.set(true);
		render([{id: 7, fileName: 'h.pdf', status: 'PENDING'}]);

		el().querySelector<HTMLButtonElement>('.polling-timeout-banner button').click();

		expect(store.refreshAttachmentsStatus).toHaveBeenCalled();
	});

	it('canRetry exige le fichier d’origine', () => {
		expect(component.canRetry({status: 'FAILED'})).toBe(false);
		expect(component.canRetry({status: 'PROCESSED', file})).toBe(false);
	});
});
