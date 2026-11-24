import {HttpErrorResponse} from '@angular/common/http';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {By} from '@angular/platform-browser';
import {provideTranslateService} from '@ngx-translate/core';
import {ObEUploadEventType, ObFileUploadComponent} from '@oblique/oblique';
import {of, throwError} from 'rxjs';
import {ObFileUploadStubComponent, aFile, provideFakeIcons, refresh} from '../../../testing/admin';
import {NotificationMock, notificationMock, provideNotificationMock} from '../../../testing/angular';
import {UploadService} from '../../shared/services/upload.service';
import {DocUploadComponent} from './doc-upload.component';

describe('DocUploadComponent', () => {
	let fixture: ComponentFixture<DocUploadComponent>;
	let component: DocUploadComponent;
	let notifications: NotificationMock;
	let uploadService: {uploadAdminDocs: jest.Mock};
	const element = (): HTMLElement => fixture.nativeElement;
	const upload = (): ObFileUploadStubComponent => fixture.debugElement.query(By.directive(ObFileUploadStubComponent)).componentInstance;
	const submitButton = (): HTMLButtonElement => element().querySelector<HTMLButtonElement>(':scope > button');

	beforeEach(() => {
		notifications = notificationMock();
		uploadService = {uploadAdminDocs: jest.fn(() => of(undefined))};
		TestBed.configureTestingModule({
			imports: [DocUploadComponent],
			providers: [provideTranslateService(), provideFakeIcons(), provideNotificationMock(notifications), {provide: UploadService, useValue: uploadService}]
		});
		TestBed.overrideComponent(DocUploadComponent, {remove: {imports: [ObFileUploadComponent]}, add: {imports: [ObFileUploadStubComponent]}});
		fixture = TestBed.createComponent(DocUploadComponent);
		component = fixture.componentInstance;
		refresh(fixture);
	});

	it('liste les fichiers choisis et ignore les autres événements', () => {
		expect(submitButton().disabled).toBe(true);

		upload().choose(aFile('directive.pdf', 2048), 'déjà-envoyé.pdf');
		component.uploadAdminDocument({type: ObEUploadEventType.UPLOADED, files: [aFile('ignoré.pdf')]});
		refresh(fixture);

		expect(component.documentsToUpload.map(doc => doc.fileName)).toEqual(['directive.pdf']);
		expect(element().querySelector('li')?.textContent).toContain('directive.pdf');
		expect(submitButton().disabled).toBe(false);
	});

	it('retire un fichier de la liste', () => {
		upload().choose(aFile('a.pdf'), aFile('b.pdf'));
		refresh(fixture);

		element().querySelector<HTMLButtonElement>('li button')?.click();
		refresh(fixture);

		expect(component.documentsToUpload.map(doc => doc.fileName)).toEqual(['b.pdf']);
		expect(element().querySelectorAll('li')).toHaveLength(1);
	});

	it('envoie les documents, notifie le succès et vide la liste', () => {
		upload().choose(aFile('a.pdf'));
		refresh(fixture);
		const documents = component.documentsToUpload;

		submitButton().click();
		refresh(fixture);

		expect(uploadService.uploadAdminDocs).toHaveBeenCalledWith(documents);
		expect(notifications.success).toHaveBeenCalledWith('admin.document.upload.success');
		expect(component.documentsToUpload).toEqual([]);
		expect(element().querySelector('li')).toBeNull();
	});

	it('notifie un échec avec la cause renvoyée par le backend et garde la liste', () => {
		uploadService.uploadAdminDocs.mockReturnValue(throwError(() => new HttpErrorResponse({status: 413})));
		upload().choose(aFile('lourd.pdf'));
		refresh(fixture);

		submitButton().click();

		expect(notifications.error).toHaveBeenCalledWith({message: 'upload.errors.FILE_TOO_LARGE'});
		expect(component.documentsToUpload).toHaveLength(1);
	});
});
