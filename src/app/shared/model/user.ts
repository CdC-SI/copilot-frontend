export interface IUser {
	firstName?: string;
	lastName?: string;
	roles: Role[];
	organizations?: string[];
}

export enum UserFormFields {
	FIRSTNAME = 'firstName',
	LASTNAME = 'lastName',
	ORGANIZATION = 'organization',
	CONFIDENTIALITY = 'confidentiality',
	GCU = 'gcu'
}

export enum Role {
	ADMIN = 'ADMIN',
	USER = 'USER'
}
