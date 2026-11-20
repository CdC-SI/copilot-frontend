import {ChangeDetectionStrategy, Component, OnInit, inject} from '@angular/core';
import {FormArray, FormBuilder, FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators} from '@angular/forms';
import {
	ObButtonDirective,
	ObColumnLayoutComponent,
	ObEUploadEventType,
	ObErrorMessagesDirective,
	ObFileUploadComponent,
	ObIUploadEvent,
	ObIconButtonDirective,
	ObMatErrorDirective,
	ObNotificationService
} from '@oblique/oblique';
import {VisionService} from '../../shared/services/vision.service';
import {MedicalService, SumexInvoice} from '../../shared/model/vision';
import {MatCard, MatCardContent, MatCardHeader, MatCardTitle} from '@angular/material/card';
import {MatButton, MatIconButton} from '@angular/material/button';
import {MatIcon} from '@angular/material/icon';
import {FilePreviewComponent} from '../../shared/components/file-preview/file-preview.component';
import {MatTab, MatTabGroup} from '@angular/material/tabs';
import {MatError, MatFormField, MatLabel} from '@angular/material/form-field';
import {MatInput} from '@angular/material/input';

@Component({
	selector: 'zco-sumex',
	templateUrl: './sumex.component.html',
	styleUrl: './sumex.component.scss',
	changeDetection: ChangeDetectionStrategy.Eager,
	imports: [
		ObColumnLayoutComponent,
		MatCard,
		MatCardHeader,
		MatCardTitle,
		MatIconButton,
		ObIconButtonDirective,
		ObButtonDirective,
		MatIcon,
		MatCardContent,
		ObFileUploadComponent,
		FilePreviewComponent,
		FormsModule,
		ReactiveFormsModule,
		MatTabGroup,
		MatTab,
		MatFormField,
		ObErrorMessagesDirective,
		MatLabel,
		MatInput,
		MatError,
		ObMatErrorDirective,
		MatButton
	]
})
export class SumexComponent implements OnInit {
	invoiceForm: FormGroup = new FormGroup({});
	documentFrmGrp: FormGroup = new FormGroup({});
	isLoading = false;
	private readonly fb = inject(FormBuilder);
	private readonly visionService = inject(VisionService);
	private readonly notifService = inject(ObNotificationService);

	ngOnInit(): void {
		this.buildInvoiceForm();
		this.buildDocumentForm();
	}

	buildDocumentForm() {
		this.documentFrmGrp = this.fb.group({
			['document']: ['', [Validators.required]]
		});
	}

	buildInvoiceForm() {
		this.invoiceForm = this.fb.group({
			author: this.fb.group({
				gln: ['', [Validators.required]],
				name: ['', [Validators.required]],
				locality: ['', [Validators.required]]
			}),
			patient: this.fb.group({
				lastName: [''],
				firstName: [''],
				street: [''],
				postalCode: [''],
				locality: [''],
				poBox: [''],
				country: [''],
				birthday: [''],
				gender: [''],
				accidentDate: [''],
				insuredPersonNumber: [''],
				caseNumber: [''],
				avsNumber: ['']
			}),
			metaData: this.fb.group({
				type: [''],
				treatmentFrom: [''],
				treatmentTo: [''],
				treatmentCause: [''],
				creationDate: [''],
				invoiceNumber: ['']
			}),
			medicalServices: this.fb.array([]),
			totalAmount: [''],
			paymentInformation: this.fb.group({
				currency: ['CHF'],
				transferType: [''],
				iban: ['', [Validators.minLength(21), Validators.maxLength(21)]],
				reference: [''],
				additionalInfo: [''],
				name: [''],
				street: [''],
				country: [''],
				postalCode: [''],
				locality: [''],
				bvr: [''],
				bicSwift: ['']
			})
		});
	}

	uploadDocumentEvent(event: ObIUploadEvent): void {
		if (event.type === ObEUploadEventType.CHOSEN) {
			event.files.forEach(file => {
				this.documentCtrl.setValue({file});
			});
		}
	}

	get documentCtrl() {
		return this.documentFrmGrp.get('document') as FormControl;
	}

	get medicalServices(): FormArray {
		return this.invoiceForm.get('medicalServices') as FormArray;
	}

	createMedicalService(data?: MedicalService): FormGroup {
		const a: FormGroup = this.fb.group({
			date: [''],
			description: [''],
			tariff: [''],
			code: [''],
			quantity: [''],
			amount: ['']
		});
		if (data) {
			a.patchValue(data);
		}
		return a;
	}

	ajouterPosition(data?: MedicalService): void {
		this.medicalServices.push(this.createMedicalService(data));
	}

	supprimerPosition(index: number): void {
		this.medicalServices.removeAt(index);
	}

	extractData() {
		this.isLoading = true;
		this.invoiceForm.disable({onlySelf: false});
		this.visionService.sumex(this.documentCtrl.value.file).subscribe({
			next: (result: SumexInvoice) => {
				this.invoiceForm.patchValue(result);
				this.invoiceForm.markAsTouched({onlySelf: false});
				this.invoiceForm.markAllAsTouched();
				(result.medicalServices ?? []).forEach(a => {
					this.ajouterPosition(a);
				});
				this.isLoading = false;
				this.invoiceForm.enable({onlySelf: false});
				this.notifService.success('La facture a été analysée avec succès.');
			},
			error: () => {
				this.isLoading = false;
			}
		});
	}

	reinit() {
		this.documentFrmGrp.reset();
		this.invoiceForm.reset();
		this.medicalServices.clear();
	}

	submitInvoice() {
		this.visionService.submitInvoice(this.invoiceForm.getRawValue() as SumexInvoice).subscribe({
			next: response => {
				this.notifService.success('La facture a été soumise avec succès.');
				const blob = response.body;
				if (!blob) return;
				const contentDisposition = response.headers.get('Content-Disposition') ?? response.headers.get('content-disposition');
				let filename = 'sumex-invoice.xml';
				if (contentDisposition) {
					const matches = /filename\*?=(?:UTF-8'')?("?)([^";]+)\1/.exec(contentDisposition);
					if (matches?.[2]) {
						filename = decodeURIComponent(matches[2]);
					}
				}
				const url = window.URL.createObjectURL(blob);
				const a = document.createElement('a');
				a.href = url;
				a.download = filename;
				document.body.appendChild(a);
				a.click();
				a.remove();
				window.URL.revokeObjectURL(url);
			},
			error: () => {
				this.notifService.error('Une erreur est survenue lors de la soumission de la facture.');
			}
		});
	}
}
