/** Résultat d'extraction de `POST /visualize/structure` : un champ demandé → valeur extraite. */
export type StructuredFields = Record<string, string | null>;

export type ZasDocumentTypeName =
	| 'ID_CARD'
	| 'PASSPORT'
	| 'DRIVER_LICENSE'
	| 'WORK_PERMIT'
	| 'SUMEX_INVOICE'
	| 'TEXT_OF_LAW'
	| 'VETERINARY_INVOICE'
	| 'UNKNOWN';

export interface ZasDocumentType {
	type: ZasDocumentTypeName;
}

export interface InvoiceAuthor {
	gln: string | null;
	name: string | null;
	locality: string | null;
}

export interface Patient {
	lastName: string | null;
	firstName: string | null;
	street: string | null;
	postalCode: string | null;
	locality: string | null;
	poBox: string | null;
	country: string | null;
	birthday: string | null;
	gender: string | null;
	accidentDate: string | null;
	insuredPersonNumber: string | null;
	caseNumber: string | null;
	avsNumber: string | null;
}

export interface InvoiceMetaData {
	type: string | null;
	treatmentFrom: string | null;
	treatmentTo: string | null;
	treatmentCause: string | null;
	creationDate: string | null;
	invoiceNumber: string | null;
}

export interface MedicalService {
	date: string | null;
	tariff: string | null;
	code: string | null;
	description: string | null;
	quantity: number | null;
	amount: number | null;
}

export interface PaymentInformation {
	currency: string | null;
	transferType: string | null;
	iban: string | null;
	reference: string | null;
	additionalInfo: string | null;
	name: string | null;
	street: string | null;
	country: string | null;
	postalCode: string | null;
	locality: string | null;
	bvr: string | null;
	bicSwift: string | null;
}

/** Miroir de `SumexInvoice` (backend). */
export interface SumexInvoice {
	author: InvoiceAuthor | null;
	patient: Patient | null;
	metaData: InvoiceMetaData | null;
	medicalServices: MedicalService[] | null;
	paymentInformation: PaymentInformation | null;
	totalAmount: number | null;
}
