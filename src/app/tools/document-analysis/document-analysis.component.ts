import {Component, HostListener, OnInit, TemplateRef, ViewChild} from '@angular/core';
import {ObEUploadEventType, ObIUploadEvent, ObNotificationService} from '@oblique/oblique';
import {FormBuilder, FormControl, FormGroup, Validators} from '@angular/forms';
import {MatChipEditedEvent, MatChipInputEvent} from '@angular/material/chips';
import {COMMA, ENTER} from '@angular/cdk/keycodes';
import {Subscription} from 'rxjs';
import {MatDialog} from '@angular/material/dialog';
import {VisionService} from '../../shared/services/vision.service';
import {AuthenticationServiceV2} from '../../shared/services/auth.service';

@Component({
	selector: 'zco-document-analysis',
	templateUrl: './document-analysis.component.html',
	styleUrl: './document-analysis.component.scss',
	standalone: false
})
export class DocumentAnalysisComponent implements OnInit {
	@ViewChild('translateDialog') translateDialog!: TemplateRef<any>;
	@ViewChild('extractDataDialog') extractDataDialog!: TemplateRef<any>;

	separatorKeysCodes: readonly number[] = [ENTER, COMMA];
	languageCtrl = new FormControl();
	documentFrmGrp: FormGroup = new FormGroup<any>({});
	requestFields: string[] = [];
	loading = false;
	requestSubscription: Subscription | null = null;

	// RESULTS
	documentType: any;
	translations: {translatedText: string}[] = [];
	selectedPageIndex = 0;
	visionFrmGrp: FormGroup = new FormGroup<any>({});
	dragging = false;

	private readonly acceptedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];

	constructor(
		private readonly fb: FormBuilder,
		private readonly visionService: VisionService,
		private readonly notif: ObNotificationService,
		private readonly dialogService: MatDialog,
		private readonly authService: AuthenticationServiceV2
	) {}

	ngOnInit() {
		this.buildForm();
	}

	@HostListener('window:paste', ['$event'])
	onPaste(event: ClipboardEvent): void {
		const files = event.clipboardData?.files;
		if (files && files.length > 0) {
			const file = files[0];
			if (this.isAcceptedFile(file)) {
				event.preventDefault();
				this.loadFile(file);
			}
		}
	}

	@HostListener('window:dragover', ['$event'])
	onDragOver(event: DragEvent): void {
		event.preventDefault();
		event.stopPropagation();
		this.dragging = true;
	}

	@HostListener('window:dragleave', ['$event'])
	onDragLeave(event: DragEvent): void {
		if (!(event.relatedTarget as Node)?.ownerDocument) {
			this.dragging = false;
		}
	}

	@HostListener('window:drop', ['$event'])
	onDrop(event: DragEvent): void {
		event.preventDefault();
		event.stopPropagation();
		this.dragging = false;
		const files = event.dataTransfer?.files;
		if (files && files.length > 0) {
			const file = files[0];
			if (this.isAcceptedFile(file)) {
				this.loadFile(file);
			}
		}
	}

	buildForm() {
		this.documentFrmGrp = this.fb.group({
			['document']: ['', [Validators.required]],
			['fields']: [[], [Validators.required]]
		});
	}

	openTranslateDialog() {
		this.dialogService
			.open(this.translateDialog, {
				width: '400px'
			})
			.afterClosed()
			.subscribe(result => {
				if (result) {
					this.translate();
				}
			});
	}

	openExtractDataDialog() {
		this.dialogService
			.open(this.extractDataDialog, {
				width: '400px'
			})
			.afterClosed()
			.subscribe(result => {
				if (result) {
					this.extractData();
				}
			});
	}

	uploadDocumentEvent(event: ObIUploadEvent): void {
		if (event.type === ObEUploadEventType.CHOSEN) {
			this.resetVisionForm();
			event.files.forEach(file => {
				this.documentCtrl.setValue({file});
			});
		}
	}

	removeRecipient(recipient: string) {
		const index = this.requestFields.indexOf(recipient);
		if (index >= 0) {
			this.requestFields.splice(index, 1);
		}
		this.fieldCtrl.setValue(this.requestFields);
	}

	addRecipient(event: MatChipInputEvent) {
		const value = (event.value || '').trim();
		if (value) {
			this.requestFields.push(value);
		}
		event.chipInput?.clear();
		this.fieldCtrl.setValue(this.requestFields);
	}

	editRecipient(recipient: string, event: MatChipEditedEvent) {
		const value = event.value.trim();
		if (!value) {
			this.removeRecipient(recipient);
		}
		const index = this.requestFields.indexOf(recipient);
		if (index >= 0) {
			this.requestFields[index] = value;
		}
		this.fieldCtrl.setValue(this.requestFields);
	}

	extractData() {
		this.resetVisionForm();
		this.loading = true;

		this.visionService.classifyFile(this.documentCtrl.value.file).subscribe(result => {
			this.documentType = result;
		});

		this.requestSubscription = this.visionService.ocrFile(this.documentCtrl.value.file, this.fieldCtrl.value.join(',')).subscribe({
			next: result => {
				Object.keys(result).forEach(key => this.addCtrlToVisionForm(key, result[key]));
				this.cancelRequest();
			},
			error: () => {
				this.cancelRequest();
			}
		});
	}

	cancelRequest() {
		if (this.requestSubscription) {
			this.requestSubscription.unsubscribe();
			this.requestSubscription = null;
			this.loading = false;
		}
	}

	resetVisionForm() {
		this.visionFrmGrp = new FormGroup<any>({});
		this.documentType = null;
		this.translations = [];
		this.selectedPageIndex = 0;
	}

	addCtrlToVisionForm(key: string, value: string) {
		this.visionFrmGrp.addControl(key, new FormControl(value));
	}

	hasTranslatorRole(): boolean {
		return this.authService.hasTranslatorRole();
	}

	hasAdminRole(): boolean {
		return this.authService.hasAdminRole();
	}

	get allVisionCtrlName(): string[] {
		return Object.keys(this.visionFrmGrp.controls);
	}

	get fieldCtrl() {
		return this.documentFrmGrp.get('fields') as FormControl;
	}

	get documentCtrl() {
		return this.documentFrmGrp.get('document') as FormControl;
	}

	loadFile(file: File): void {
		this.resetVisionForm();
		this.documentCtrl.setValue({file});
	}

	private isAcceptedFile(file: File): boolean {
		return this.acceptedTypes.includes(file.type);
	}

	translate() {
		this.resetVisionForm();
		this.loading = true;

		this.requestSubscription = this.visionService.translateFile(this.documentCtrl.value.file, this.languageCtrl.value).subscribe({
			next: result => {
				this.translations = result;
				this.selectedPageIndex = 0;
				this.cancelRequest();
			},
			error: () => {
				this.cancelRequest();
			}
		});
	}
}
