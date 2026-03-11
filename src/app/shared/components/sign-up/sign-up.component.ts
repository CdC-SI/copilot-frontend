import {Component, OnInit} from '@angular/core';
import {FormBuilder, FormGroup, Validators} from '@angular/forms';
import {UserFormFields} from '../../model/user';
import {MatDialogRef} from '@angular/material/dialog';
import {AuthenticationServiceV2} from '../../services/auth.service';

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

	// Document texts (à remplacer par votre contenu)
	confidentialityText: string = `Ceci est un exemple de texte pour la politique de confidentialité.
	Lorem ipsum dolor sit amet, consectetur adipiscing elit. Cras sollicitudin, urna quis rhoncus placerat, dolor odio iaculis mauris, vel auctor felis neque vitae nibh. Nullam eros tellus, pharetra ac accumsan et, hendrerit quis risus. Morbi eget lorem sed tellus condimentum tempor sit amet mollis mi. Vivamus metus purus, hendrerit non bibendum maximus, feugiat sed erat. Phasellus nec ornare magna. Aenean placerat nisl purus, ac consectetur erat efficitur vulputate. Sed id lectus molestie, tempus nisi sit amet, laoreet tellus. Nullam et mauris sed enim finibus lobortis eu id ex. Ut felis tellus, porttitor sit amet arcu id, porta sodales odio. In tincidunt a leo vitae congue. Mauris erat ligula, elementum vitae felis in, pretium lacinia urna. Ut eu purus enim. Praesent maximus sed nibh vitae imperdiet. Nam nec imperdiet orci. Vivamus vestibulum pretium mauris aliquet placerat.

In vestibulum, urna et facilisis vestibulum, dui ipsum rhoncus purus, vitae lacinia est mauris in tellus. Phasellus pellentesque pharetra venenatis. Aliquam tincidunt lorem nec mattis scelerisque. Nunc ultrices augue ac dignissim condimentum. Ut lobortis ligula id quam luctus rhoncus. In ac augue ac purus laoreet lobortis. Donec ultricies massa in sem gravida, vel vehicula neque mollis. Nullam ligula diam, posuere non ultricies sed, fringilla egestas mauris. Maecenas euismod lectus ac semper molestie. Integer vulputate arcu massa, ac ornare dui feugiat a. Cras suscipit risus dolor, ac hendrerit ex efficitur vel. Quisque elit felis, feugiat sit amet tincidunt quis, interdum in leo. Morbi leo nunc, vulputate eget fermentum in, blandit at arcu. Mauris molestie porta condimentum. Integer egestas, felis non commodo efficitur, neque orci molestie diam, ac tincidunt magna nibh eget purus.

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nunc laoreet nisl quis pharetra finibus. Sed luctus, augue id sollicitudin lacinia, orci est congue lorem, vel iaculis dui dui non arcu. Integer congue condimentum magna, a convallis nunc dapibus vitae. Morbi risus neque, sodales vel lacus id, consequat tristique turpis. Aenean imperdiet faucibus tellus. Vivamus lacinia maximus ex, id eleifend magna aliquam vitae. Orci varius natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus. Praesent sed tortor dapibus, pellentesque elit vel, imperdiet neque. Nam nec tellus est. Nullam tortor velit, condimentum vel mauris vitae, finibus lacinia enim. Sed vitae mauris metus. Aenean et nibh imperdiet, pellentesque lacus nec, vestibulum elit.

Curabitur euismod tellus ut dui lobortis finibus. Ut sit amet massa et leo efficitur vulputate. Mauris rutrum, dolor sed cursus efficitur, ex lectus egestas nisl, id interdum urna nisl vitae lorem. Morbi varius a nibh id vulputate. Nullam porta, turpis ac tempus ullamcorper, lorem velit tempor velit, ac condimentum est eros id nisl. Mauris consequat molestie auctor. Proin ultrices sit amet enim nec tincidunt. Nullam ut arcu ut nisl finibus malesuada. Pellentesque ultricies ex dignissim sapien pulvinar finibus. Mauris imperdiet pharetra nisi, ac lobortis magna pharetra et. Curabitur eu sem fringilla, sagittis urna ut, iaculis dui. Donec auctor sed leo nec dignissim. Mauris sit amet congue mauris, in lacinia dui. Donec at libero varius, sagittis arcu quis, placerat elit.

Phasellus viverra euismod nisi, vel vehicula augue condimentum vel. Quisque mollis hendrerit malesuada. Vivamus nec porta metus, quis lobortis dui. Nam ipsum purus, semper ac tellus rutrum, aliquet egestas enim. Donec pulvinar rutrum eros, sit amet malesuada lacus lobortis ac. Vestibulum pharetra bibendum diam et tincidunt. Integer vel sem massa. Morbi lacinia eleifend velit maximus condimentum. Duis ac elit in nisl venenatis mattis.`;

	gcuText: string = `Ceci est un exemple de texte pour les conditions générales d'utilisation.
	Lorem ipsum dolor sit amet, consectetur adipiscing elit. Cras sollicitudin, urna quis rhoncus placerat, dolor odio iaculis mauris, vel auctor felis neque vitae nibh. Nullam eros tellus, pharetra ac accumsan et, hendrerit quis risus. Morbi eget lorem sed tellus condimentum tempor sit amet mollis mi. Vivamus metus purus, hendrerit non bibendum maximus, feugiat sed erat. Phasellus nec ornare magna. Aenean placerat nisl purus, ac consectetur erat efficitur vulputate. Sed id lectus molestie, tempus nisi sit amet, laoreet tellus. Nullam et mauris sed enim finibus lobortis eu id ex. Ut felis tellus, porttitor sit amet arcu id, porta sodales odio. In tincidunt a leo vitae congue. Mauris erat ligula, elementum vitae felis in, pretium lacinia urna. Ut eu purus enim. Praesent maximus sed nibh vitae imperdiet. Nam nec imperdiet orci. Vivamus vestibulum pretium mauris aliquet placerat.

In vestibulum, urna et facilisis vestibulum, dui ipsum rhoncus purus, vitae lacinia est mauris in tellus. Phasellus pellentesque pharetra venenatis. Aliquam tincidunt lorem nec mattis scelerisque. Nunc ultrices augue ac dignissim condimentum. Ut lobortis ligula id quam luctus rhoncus. In ac augue ac purus laoreet lobortis. Donec ultricies massa in sem gravida, vel vehicula neque mollis. Nullam ligula diam, posuere non ultricies sed, fringilla egestas mauris. Maecenas euismod lectus ac semper molestie. Integer vulputate arcu massa, ac ornare dui feugiat a. Cras suscipit risus dolor, ac hendrerit ex efficitur vel. Quisque elit felis, feugiat sit amet tincidunt quis, interdum in leo. Morbi leo nunc, vulputate eget fermentum in, blandit at arcu. Mauris molestie porta condimentum. Integer egestas, felis non commodo efficitur, neque orci molestie diam, ac tincidunt magna nibh eget purus.

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nunc laoreet nisl quis pharetra finibus. Sed luctus, augue id sollicitudin lacinia, orci est congue lorem, vel iaculis dui dui non arcu. Integer congue condimentum magna, a convallis nunc dapibus vitae. Morbi risus neque, sodales vel lacus id, consequat tristique turpis. Aenean imperdiet faucibus tellus. Vivamus lacinia maximus ex, id eleifend magna aliquam vitae. Orci varius natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus. Praesent sed tortor dapibus, pellentesque elit vel, imperdiet neque. Nam nec tellus est. Nullam tortor velit, condimentum vel mauris vitae, finibus lacinia enim. Sed vitae mauris metus. Aenean et nibh imperdiet, pellentesque lacus nec, vestibulum elit.

Curabitur euismod tellus ut dui lobortis finibus. Ut sit amet massa et leo efficitur vulputate. Mauris rutrum, dolor sed cursus efficitur, ex lectus egestas nisl, id interdum urna nisl vitae lorem. Morbi varius a nibh id vulputate. Nullam porta, turpis ac tempus ullamcorper, lorem velit tempor velit, ac condimentum est eros id nisl. Mauris consequat molestie auctor. Proin ultrices sit amet enim nec tincidunt. Nullam ut arcu ut nisl finibus malesuada. Pellentesque ultricies ex dignissim sapien pulvinar finibus. Mauris imperdiet pharetra nisi, ac lobortis magna pharetra et. Curabitur eu sem fringilla, sagittis urna ut, iaculis dui. Donec auctor sed leo nec dignissim. Mauris sit amet congue mauris, in lacinia dui. Donec at libero varius, sagittis arcu quis, placerat elit.

Phasellus viverra euismod nisi, vel vehicula augue condimentum vel. Quisque mollis hendrerit malesuada. Vivamus nec porta metus, quis lobortis dui. Nam ipsum purus, semper ac tellus rutrum, aliquet egestas enim. Donec pulvinar rutrum eros, sit amet malesuada lacus lobortis ac. Vestibulum pharetra bibendum diam et tincidunt. Integer vel sem massa. Morbi lacinia eleifend velit maximus condimentum. Duis ac elit in nisl venenatis mattis.`;

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
