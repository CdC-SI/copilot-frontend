import {Component, Input, OnChanges} from '@angular/core';
import {DomSanitizer, SafeResourceUrl} from '@angular/platform-browser';

@Component({
	selector: 'app-file-preview',
	standalone: false,
	templateUrl: './file-preview.component.html',
	styleUrl: './file-preview.component.scss'
})
export class FilePreviewComponent implements OnChanges {
	@Input() file!: File;

	previewUrl: SafeResourceUrl | null = null;
	isImage: boolean = false;

	constructor(private readonly sanitizer: DomSanitizer) {}

	ngOnChanges(): void {
		if (!this.file) return;
		const fileType = this.file.type;

		if (fileType.startsWith('image')) {
			this.isImage = true;
			const reader = new FileReader();
			reader.onload = () => {
				this.previewUrl = this.sanitizer.bypassSecurityTrustUrl(reader.result as string);
			};
			reader.readAsDataURL(this.file);
		} else if (fileType === 'application/pdf') {
			this.isImage = false;
			const fileURL = URL.createObjectURL(this.file);
			this.previewUrl = this.sanitizer.bypassSecurityTrustResourceUrl(fileURL);
		}
	}
}
