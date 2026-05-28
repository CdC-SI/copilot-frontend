import {Component, OnInit} from '@angular/core';
import {FormBuilder, FormGroup, Validators} from '@angular/forms';
import {UserFormFields} from '../../model/user';
import {MatDialogRef} from '@angular/material/dialog';
import {AuthenticationServiceV2} from '../../services/auth.service';
import {LEGAL_CONFIDENTIALITY_TEXT, LEGAL_GCU_TEXT} from '../../constants/legal-texts.constants';

@Component({
	selector: 'zco-sign-up',
	templateUrl: './sign-up.component.html',
	styleUrl: './sign-up.component.scss'
})
export class SignUpComponent implements OnInit {
	FORM_FIELDS = UserFormFields;
	userFrmGrp: FormGroup;
	userIsFromZas: boolean = true;

	// Scroll tracking states - track if user scrolled to bottom of each document
	hasScrolledConfidentialityToBottom: boolean = false;
	hasScrolledGCUToBottom: boolean = false;

	// Track if user has checked "I have read"
	hasReadDocumentsChecked: boolean = false;

	selectedTabIndex: number = 0;

	// Computed property: "I have read" checkbox is enabled only after scrolling both documents to bottom
	get canCheckHasRead(): boolean {
		return this.hasScrolledConfidentialityToBottom && this.hasScrolledGCUToBottom;
	}

	// Computed property: "I accept" checkbox is enabled only after checking "I have read"
	get canCheckAccept(): boolean {
		return this.hasReadDocumentsChecked;
	}

	// Custom form validity check that includes disabled controls
	get isFormValid(): boolean {
		// Check if firstname and lastname are valid
		const firstNameValid = this.userFrmGrp.get(UserFormFields.FIRSTNAME)?.valid;
		const lastNameValid = this.userFrmGrp.get(UserFormFields.LASTNAME)?.valid;
		// Check if confidentiality is accepted (even if disabled, we need to check its value)
		const confidentialityValue = this.userFrmGrp.get(UserFormFields.CONFIDENTIALITY)?.value;

		return !!(firstNameValid && lastNameValid && confidentialityValue);
	}

	// Reuse texts from the shared legal document dialog
	confidentialityText = LEGAL_CONFIDENTIALITY_TEXT;
	gcuText = LEGAL_GCU_TEXT;

	constructor(
		private readonly fb: FormBuilder,
		private readonly authService: AuthenticationServiceV2,
		public dialogRef: MatDialogRef<SignUpComponent>
	) {}

	ngOnInit() {
		this.buildForm();
	}

	buildForm() {
		this.userFrmGrp = this.fb.group({
			[UserFormFields.FIRSTNAME]: [this.authService.$authenticatedUser.getValue()?.firstName, Validators.required],
			[UserFormFields.LASTNAME]: [this.authService.$authenticatedUser.getValue()?.lastName, Validators.required],
			[UserFormFields.CONFIDENTIALITY]: [{value: false, disabled: true}, Validators.requiredTrue]
		});
	}

	onScroll(event: Event, documentType: 'confidentiality' | 'gcu'): void {
		const element = event.target as HTMLElement;
		const scrollPosition = element.scrollTop + element.clientHeight;
		const scrollHeight = element.scrollHeight;

		// Consider as "read" when user scrolls to within 50px of the bottom
		const threshold = 50;
		if (scrollHeight - scrollPosition <= threshold) {
			if (documentType === 'confidentiality') {
				this.hasScrolledConfidentialityToBottom = true;
			} else {
				this.hasScrolledGCUToBottom = true;
			}
		}
	}

	onHasReadChange(): void {
		const confidentialityControl = this.userFrmGrp.get(UserFormFields.CONFIDENTIALITY);

		if (this.hasReadDocumentsChecked) {
			// Enable the "I accept" checkbox when "I have read" is checked
			confidentialityControl?.enable();
		} else {
			// Disable and uncheck the "I accept" checkbox when "I have read" is unchecked
			confidentialityControl?.setValue(false);
			confidentialityControl?.disable();
		}
	}

	onTabChange(index: number): void {
		this.selectedTabIndex = index;
	}

	onConfirmClick(): void {
		const formValue = this.userFrmGrp.getRawValue();
		const requestBody = {
			firstName: formValue[UserFormFields.FIRSTNAME],
			lastName: formValue[UserFormFields.LASTNAME],
			organizations: this.userIsFromZas ? ['ZAS'] : []
		};
		this.dialogRef.close(requestBody);
	}

	onToggleChange() {
		this.userIsFromZas = !this.userIsFromZas;
	}
}
