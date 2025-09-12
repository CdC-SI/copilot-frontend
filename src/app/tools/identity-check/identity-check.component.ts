import {Component, ElementRef, OnInit, TemplateRef, ViewChild} from '@angular/core';
import {IdentityCheckService} from '../../shared/services/identity-check.service';
import {AuthenticationServiceV2} from '../../shared/services/auth.service';
import {FormBuilder, FormGroup, Validators} from '@angular/forms';
import {MatDialog, MatDialogRef} from '@angular/material/dialog';
import {VisionService} from '../../shared/services/vision.service';

@Component({
	selector: 'zco-identity-check',
	templateUrl: './identity-check.component.html',
	styleUrls: ['./identity-check.component.scss'],
	standalone: false
})
export class IdentityCheckComponent implements OnInit {
	@ViewChild('video') videoElement!: ElementRef<HTMLVideoElement>;
	capturedImage: string | null = null;
	stream!: MediaStream;

	identityCheckStatus: any;
	form: FormGroup;
	dialogRef!: MatDialogRef<any>;

	constructor(
		private readonly authenticateService: IdentityCheckService,
		private readonly authService: AuthenticationServiceV2,
		private readonly fb: FormBuilder,
		private readonly dialog: MatDialog,
		private readonly visionService: VisionService
	) {
		this.form = this.fb.group({
			email: ['', [Validators.required, Validators.email]],
			mobilePhone: ['', [Validators.required]],
			dateOfBirth: ['', Validators.required],
			street: ['', Validators.required],
			streetNr: ['', Validators.required],
			zip: ['', Validators.required],
			city: ['', Validators.required],
			country: ['', Validators.required],
			nationality: ['', Validators.required],
			idNumber: ['', Validators.required],
			idType: ['', Validators.required],
			gender: ['', Validators.required]
		});
	}

	ngOnInit(): void {
		this.refreshStatus();
	}

	startCamera() {
		navigator.mediaDevices
			.getUserMedia({video: true})
			.then(stream => {
				this.stream = stream;
				this.videoElement.nativeElement.srcObject = stream;
			})
			.catch(err => {
				console.error('Erreur accès webcam:', err);
			});
	}

	refreshStatus() {
		this.authenticateService.getIdentityCheckStatus().subscribe(response => {
			this.identityCheckStatus = response;
		});
	}

	capturePhoto() {
		const canvas = document.createElement('canvas');
		canvas.width = this.videoElement.nativeElement.videoWidth;
		canvas.height = this.videoElement.nativeElement.videoHeight;
		const context = canvas.getContext('2d');
		if (context) {
			context.drawImage(this.videoElement.nativeElement, 0, 0, canvas.width, canvas.height);
			this.capturedImage = canvas.toDataURL('image/jpeg');
			canvas.toBlob(blob => {
				if (blob) {
					const file = new File([blob], 'document.jpg', {type: 'image/jpeg'});
					this.sendToOCR(file);
				}
			}, 'image/jpeg');
		}

		this.stopCamera();
	}

	retakePhoto() {
		this.capturedImage = null;
		this.startCamera();
	}

	stopCamera() {
		this.stream?.getTracks().forEach(track => track.stop());
	}

	sendToOCR(file: File) {
		const fields = [
			'dateOfBirth',
			'residenceStreet',
			'residenceStreetNr',
			'residenceZip',
			'residenceCity',
			'country',
			'nationality',
			'documentNumber',
			'documentType',
			'gender'
		].join(',');

		this.visionService.ocrFile(file, fields).subscribe(ocrResult => {
			this.form.patchValue({
				dateOfBirth: ocrResult.dateOfBirth,
				street: ocrResult.residenceStreet,
				streetNr: ocrResult.residenceStreetNr,
				zip: ocrResult.residenceZip,
				city: ocrResult.residenceCity,
				country: ocrResult.country,
				nationality: ocrResult.nationality,
				idNumber: ocrResult.documentNumber,
				idType: ocrResult.documentType,
				gender: ocrResult.gender,
			});
		});
	}

	openDialog(template: TemplateRef<any>) {
		this.dialogRef = this.dialog.open(template, {width: '700px'});
	}

	closeDialog() {
		this.stopCamera();
		this.stream = null;
		this.capturedImage = null;
		this.form.reset();
		this.dialogRef.close();
	}

	submitDialog() {
		if (this.form.valid) {
			const formData = this.form.value;
			this.dialogRef.close();
			this.authenticateService.startIdentyCheck(formData).subscribe(response => {
				window.open(response.endpoint, '_blank');
			});
		}
	}
}
