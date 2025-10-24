export interface IUser {
	username: string;
	firstName?: string;
	lastName?: string;
	status: UserStatus;
	roles: Role[];
	organizations?: string[];
	internalUser: boolean;
	actions?: IUserAction[];
}

export enum UserStatus {
	PENDING_ACTIVATION = 'PENDING_ACTIVATION',
	ACTIVE = 'ACTIVE',
	INACTIVE = 'INACTIVE',
	GUEST = 'GUEST',
	JOHN_DOE = 'JOHN_DOE'
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
	USER = 'USER',
	EXPERT = 'EXPERT'
}

export interface IUserAction {
	id: 'validate' | 'reactivate' | 'deactivate' | 'promote' | 'demote' | 'internalize' | 'externalize';
	icon: string;
	tooltip: string;
}
