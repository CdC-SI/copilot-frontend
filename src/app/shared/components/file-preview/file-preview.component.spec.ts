import {ComponentFixture, TestBed} from '@angular/core/testing';
import {detectAsyncChanges} from '../../../../testing/shared-components';
import {FilePreviewComponent} from './file-preview.component';

describe('FilePreviewComponent', () => {
	let fixture: ComponentFixture<FilePreviewComponent>;
	const el = (): HTMLElement => fixture.nativeElement;
	const originalCreateObjectURL = URL.createObjectURL;

	beforeEach(() => {
		// jsdom n'implémente pas les URL d'objets.
		URL.createObjectURL = jest.fn(() => 'blob:http://localhost/pdf-1');
		TestBed.configureTestingModule({imports: [FilePreviewComponent]});
		fixture = TestBed.createComponent(FilePreviewComponent);
	});

	afterEach(() => {
		URL.createObjectURL = originalCreateObjectURL;
	});

	const show = (file: File | undefined): void => {
		fixture.componentRef.setInput('file', file);
		fixture.detectChanges();
	};

	it('n’affiche rien sans fichier', () => {
		show(undefined);

		expect(el().querySelector('.file-preview-container')).toBeNull();
		expect(fixture.componentInstance.previewUrl).toBeNull();
	});

	it('affiche une image lue en data URL', async () => {
		const image = new File(['png'], 'photo.png', {type: 'image/png'});
		const loaded = new Promise<void>(resolve => {
			const original = FileReader.prototype.readAsDataURL;
			jest.spyOn(FileReader.prototype, 'readAsDataURL').mockImplementation(function (this: FileReader, blob: Blob) {
				this.addEventListener('load', () => setTimeout(resolve));
				original.call(this, blob);
			});
		});

		show(image);
		await loaded;
		detectAsyncChanges(fixture);

		const img = el().querySelector<HTMLImageElement>('.image-preview img');
		expect(fixture.componentInstance.isImage).toBe(true);
		expect(img.src).toBe('data:image/png;base64,cG5n');
		expect(el().querySelector('iframe')).toBeNull();
	});

	it('affiche un PDF dans une iframe via une URL d’objet', () => {
		const pdf = new File(['%PDF'], 'doc.pdf', {type: 'application/pdf'});

		show(pdf);

		expect(URL.createObjectURL).toHaveBeenCalledWith(pdf);
		expect(fixture.componentInstance.isImage).toBe(false);
		expect(el().querySelector<HTMLIFrameElement>('iframe.pdf-preview').src).toBe('blob:http://localhost/pdf-1');
		expect(el().querySelector('img')).toBeNull();
	});

	it('ignore les autres types de fichier', () => {
		show(new File(['a;b'], 'data.csv', {type: 'text/csv'}));

		expect(URL.createObjectURL).not.toHaveBeenCalled();
		expect(el().querySelector('.file-preview-container')).toBeNull();
	});
});
