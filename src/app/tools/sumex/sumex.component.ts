import {Component, OnInit} from '@angular/core';
import {FormArray, FormBuilder, FormControl, FormGroup, Validators} from '@angular/forms';
import {ObEUploadEventType, ObIUploadEvent, ObNotificationService} from '@oblique/oblique';
import {VisionService} from '../../shared/services/vision.service';

@Component({
	selector: 'zco-sumex',
	templateUrl: './sumex.component.html',
	styleUrl: './sumex.component.scss'
})
export class SumexComponent implements OnInit {
	invoiceForm: FormGroup = new FormGroup<any>({});
	documentFrmGrp: FormGroup = new FormGroup<any>({});
	isLoading = false;

	constructor(
		private readonly fb: FormBuilder,
		private readonly visionService: VisionService,
		private readonly notifService: ObNotificationService
	) {}

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
				gln: [''],
				name: [''],
				locality: ['']
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
				iban: [''],
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

	createMedicalService(data?: any): FormGroup {
		const a = this.fb.group({
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

	ajouterPosition(data?: any): void {
		this.medicalServices.push(this.createMedicalService(data));
	}

	supprimerPosition(index: number): void {
		this.medicalServices.removeAt(index);
	}

	trackByIndex(index: number): number {
		return index;
	}

	extractData() {
		this.isLoading = true;
		this.invoiceForm.disable({onlySelf: false});
		this.visionService.sumex(this.documentCtrl.value.file).subscribe({
			next: result => {
				this.invoiceForm.patchValue(result);
				// @ts-ignore
				result.medicalServices.forEach(a => {
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
		this.visionService.submitInvoice(this.invoiceForm.getRawValue()).subscribe({
			next: response => {
				this.notifService.success('La facture a été soumise avec succès.');
				const blob = response.body;
				if (!blob) return;
				const contentDisposition = response.headers.get('Content-Disposition') ?? response.headers.get('content-disposition');
				let filename = 'sumex-invoice.xml';
				if (contentDisposition) {
					const matches = /filename\*?=(?:UTF-8'')?("?)([^";]+)\1/.exec(contentDisposition);
					if (matches && matches[2]) {
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
