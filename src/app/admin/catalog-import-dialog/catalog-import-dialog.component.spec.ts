import {HttpErrorResponse} from '@angular/common/http';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {By} from '@angular/platform-browser';
import {provideTranslateService} from '@ngx-translate/core';
import {ObEUploadEventType, ObFileUploadComponent} from '@oblique/oblique';
import {Subject, of, throwError} from 'rxjs';
import {DialogRefMock, ObFileUploadStubComponent, aFile, dialogRefMock, provideDialogRefMock, provideFakeIcons, refresh} from '../../../testing/admin';
import {NotificationMock, notificationMock, provideNotificationMock} from '../../../testing/angular';
import {CatalogImportReport} from '../../shared/model/catalog';
import {CatalogService} from '../../shared/services/catalog.service';
import {CatalogImportDialogComponent} from './catalog-import-dialog.component';

describe('CatalogImportDialogComponent', () => {
	let fixture: ComponentFixture<CatalogImportDialogComponent>;
	let component: CatalogImportDialogComponent;
	let ref: DialogRefMock;
	let notifications: NotificationMock;
	let catalogService: {import: jest.Mock; export: jest.Mock};
	const report: CatalogImportReport = {
		sources: {created: ['avs', 'lpp'], updated: [], unchanged: ['ai']},
		workspaces: {created: [], updated: ['retraite'], unchanged: []}
	};
	const element = (): HTMLElement => fixture.nativeElement;
	const text = (): string => element().textContent?.replace(/\s+/g, ' ') ?? '';
	const upload = (): ObFileUploadStubComponent | undefined => fixture.debugElement.query(By.directive(ObFileUploadStubComponent))?.componentInstance;
	const actions = (): HTMLButtonElement[] => Array.from(element().querySelectorAll<HTMLButtonElement>('mat-dialog-actions button'));
	const [exportButton, closeButton, importButton] = [0, 1, 2].map(index => (): HTMLButtonElement => actions()[index]);

	const chooseFile = (): void => {
		upload()?.choose(aFile('catalog.yaml', 2048, 'application/yaml'));
		refresh(fixture);
	};

	beforeEach(() => {
		ref = dialogRefMock();
		notifications = notificationMock();
		catalogService = {import: jest.fn(() => of(report)), export: jest.fn(() => of(new Blob(['version: 1'])))};
		TestBed.configureTestingModule({
			imports: [CatalogImportDialogComponent],
			providers: [
				provideTranslateService(),
				provideFakeIcons(),
				provideNotificationMock(notifications),
				provideDialogRefMock(ref),
				{provide: CatalogService, useValue: catalogService}
			]
		});
		TestBed.overrideComponent(CatalogImportDialogComponent, {remove: {imports: [ObFileUploadComponent]}, add: {imports: [ObFileUploadStubComponent]}});
		fixture = TestBed.createComponent(CatalogImportDialogComponent);
		component = fixture.componentInstance;
		refresh(fixture);
	});

	afterEach(() => jest.restoreAllMocks());

	it('empêche la fermeture implicite pour toujours renvoyer le résultat', () => {
		expect(ref.disableClose).toBe(true);
		expect(importButton().disabled).toBe(true);
		expect(upload()?.accept()).toEqual(['.yaml', '.yml']);
	});

	it('importe le fichier choisi et affiche le rapport', () => {
		chooseFile();
		expect(upload()).toBeUndefined();
		expect(text()).toContain('catalog.yaml (2 KB)');

		importButton().click();
		refresh(fixture);

		expect(catalogService.import).toHaveBeenCalledWith(expect.objectContaining({name: 'catalog.yaml'}));
		expect(notifications.success).toHaveBeenCalledWith('admin.catalog.import.success');
		expect(component.file).toBeNull();
		const chips = Array.from(element().querySelectorAll('mat-chip')).map(chip => chip.textContent?.trim());
		expect(chips).toEqual(['avs', 'lpp', 'ai', 'retraite']);
		expect(element().querySelectorAll('.none')).toHaveLength(3);

		closeButton().click();
		expect(ref.close).toHaveBeenCalledWith({imported: true});
	});

	it('affiche les erreurs de validation du catalogue', () => {
		catalogService.import.mockReturnValue(
			throwError(() => new HttpErrorResponse({status: 400, error: {error: 'invalid', messages: ['sources[0].name manquant']}}))
		);
		chooseFile();

		importButton().click();
		refresh(fixture);

		expect(notifications.error).toHaveBeenCalledWith('admin.catalog.import.error');
		expect(element().querySelector('.errors li')?.textContent).toBe('sources[0].name manquant');
		expect(component.file).not.toBeNull();
		expect(component.importing).toBe(false);
	});

	it('n’affiche pas de détail pour une autre erreur', () => {
		catalogService.import.mockReturnValue(throwError(() => new HttpErrorResponse({status: 500, error: null})));
		chooseFile();

		component.importFile();

		expect(component.errors).toEqual([]);
		expect(notifications.error).toHaveBeenCalledWith('admin.catalog.import.error');
	});

	it('retire le fichier choisi et ignore les autres événements d’upload', () => {
		component.onFileChosen({type: ObEUploadEventType.UPLOADED, files: [aFile('autre.yaml')]});
		expect(component.file).toBeNull();
		component.importFile();
		expect(catalogService.import).not.toHaveBeenCalled();

		chooseFile();
		element().querySelector<HTMLButtonElement>('.selected-file button')?.click();
		refresh(fixture);

		expect(component.file).toBeNull();
		expect(upload()).toBeDefined();
	});

	it('ne se ferme pas pendant un import, puis renvoie le résultat par le fond ou Échap', () => {
		const import$ = new Subject<CatalogImportReport>();
		catalogService.import.mockReturnValue(import$);
		chooseFile();
		component.importFile();
		refresh(fixture);
		expect(element().querySelector('mat-progress-bar')).not.toBeNull();
		expect(closeButton().disabled).toBe(true);

		ref.backdrop.next(new MouseEvent('click'));
		component.importFile();
		expect(ref.close).not.toHaveBeenCalled();
		expect(catalogService.import).toHaveBeenCalledTimes(1);

		import$.next(report);
		ref.keydown.next(new KeyboardEvent('keydown', {key: 'Enter'}));
		expect(ref.close).not.toHaveBeenCalled();
		ref.keydown.next(new KeyboardEvent('keydown', {key: 'Escape'}));
		expect(ref.close).toHaveBeenCalledWith({imported: true});
	});

	it('renvoie « aucun import » si rien n’a été importé', () => {
		ref.backdrop.next(new MouseEvent('click'));

		expect(ref.close).toHaveBeenCalledWith({imported: false});
	});

	it('exporte le catalogue en YAML', () => {
		const createObjectURL = jest.fn(() => 'blob:catalog');
		const revokeObjectURL = jest.fn();
		Object.assign(globalThis.URL, {createObjectURL, revokeObjectURL});
		const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

		exportButton().click();

		expect(catalogService.export).toHaveBeenCalled();
		expect(click).toHaveBeenCalled();
		expect((click.mock.contexts[0] as HTMLAnchorElement).download).toBe('catalog.yaml');
		expect(revokeObjectURL).toHaveBeenCalledWith('blob:catalog');
		expect(component.exporting).toBe(false);
	});

	it('notifie un export en échec et ignore un double clic', () => {
		const export$ = new Subject<Blob>();
		catalogService.export.mockReturnValue(export$);

		component.exportCatalog();
		component.exportCatalog();
		export$.error(new Error('500'));

		expect(catalogService.export).toHaveBeenCalledTimes(1);
		expect(notifications.error).toHaveBeenCalledWith('admin.catalog.export.error');
		expect(component.exporting).toBe(false);
	});
});
