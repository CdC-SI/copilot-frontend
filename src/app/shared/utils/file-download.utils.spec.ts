import {isPdf, openOrDownloadBlob} from './file-download.utils';

describe('file-download utils', () => {
	beforeEach(() => {
		window.URL.createObjectURL = jest.fn(() => 'blob:url');
		window.URL.revokeObjectURL = jest.fn();
		jest.spyOn(window, 'open').mockImplementation(() => null);
	});

	afterEach(() => jest.restoreAllMocks());

	it('detects PDF from the blob type or the file extension', () => {
		expect(isPdf(new Blob([], {type: 'application/pdf'}), 'doc')).toBe(true);
		expect(isPdf(new Blob([]), 'Rapport.PDF')).toBe(true);
		expect(isPdf(new Blob([]), 'rapport.docx')).toBe(false);
	});

	it('opens PDF documents in a new tab', () => {
		openOrDownloadBlob(new Blob(['x'], {type: 'application/pdf'}), 'source.pdf');

		expect(window.open).toHaveBeenCalledWith('blob:url', '_blank');
	});

	it('downloads Office documents under their file name', () => {
		const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
		const blob = new Blob(['x'], {type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});

		openOrDownloadBlob(blob, 'tableau.xlsx');

		expect(window.open).not.toHaveBeenCalled();
		expect(click).toHaveBeenCalled();
		expect((click.mock.contexts[0] as HTMLAnchorElement).download).toBe('tableau.xlsx');
		expect(window.URL.revokeObjectURL).toHaveBeenCalledWith('blob:url');
	});
});
