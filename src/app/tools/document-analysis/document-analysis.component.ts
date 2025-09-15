import {Component, OnInit, TemplateRef, ViewChild} from '@angular/core';
import {ObEUploadEventType, ObIUploadEvent, ObNotificationService} from '@oblique/oblique';
import {FormBuilder, FormControl, FormGroup, Validators} from '@angular/forms';
import {MatChipEditedEvent, MatChipInputEvent} from '@angular/material/chips';
import {COMMA, ENTER} from '@angular/cdk/keycodes';
import {Subscription} from 'rxjs';
import {MatDialog} from '@angular/material/dialog';
import {VisionService} from '../../shared/services/vision.service';

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
	translation: string = '';
	visionFrmGrp: FormGroup = new FormGroup<any>({});

	constructor(
		private readonly fb: FormBuilder,
		private readonly visionService: VisionService,
		private readonly notif: ObNotificationService,
		private readonly dialogService: MatDialog
	) {}

	ngOnInit() {
		this.buildForm();
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
		this.translation = '';
	}

	addCtrlToVisionForm(key: string, value: string) {
		this.visionFrmGrp.addControl(key, new FormControl(value));
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

	translate() {
		this.resetVisionForm();
		this.loading = true;

		this.requestSubscription = this.visionService.translateFile(this.documentCtrl.value.file, this.languageCtrl.value).subscribe({
			next: result => {
				this.translation = result.translatedText;
				this.cancelRequest();
			},
			error: () => {
				this.cancelRequest();
			}
		});
	}
}
