/** Miroir de `IdentityPersonData` (backend). */
export interface IdentityPersonData {
	userAnonymousId: string | null;
	firstname: string | null;
	lastname: string | null;
	correspondingLang: string | null;
	dateOfBirth: string | null;
	street: string | null;
	streetNr: string | null;
	zip: string | null;
	city: string | null;
	country: string | null;
	email: string | null;
	mobilePhone: string | null;
	nationality: string | null;
	idNumber: string | null;
	idType: string | null;
	gender: string | null;
}

/** Données saisies dans le formulaire de démarrage (corps de `POST /identity-check/start`). */
export interface IdentityCheckStartRequest {
	email: string;
	mobilePhone: string;
	dateOfBirth: string;
	street: string;
	streetNr: string;
	zip: string;
	city: string;
	country: string;
	nationality: string;
	idNumber: string;
	idType: string;
	gender: string;
}

export interface IdentityCheckResponse {
	vipsTransactionId: string;
	endpoint: string;
}

/** `state` vaut `NOT_STARTED` ou un état VIPS (`initiated`, `reviewPending`, `identificationSuccessful`…). */
export interface IdentityCheckStatus {
	id: string | null;
	state: string;
	identificationMethod: string | null;
	timestamp: string | null;
	userdata: IdentityPersonData | null;
}
