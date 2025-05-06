export interface IUser {
	firstName?: string;
	lastName?: string;
	status: UserStatus;
	roles: Role[];
	organizations?: string[];
}

export enum UserStatus {
	PENDING_ACTIVATION = 'PENDING_ACTIVATION',
	ACTIVE = 'ACTIVE',
	INACTIVE = 'INACTIVE',
	GUEST = 'GUEST'
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
