export interface IUser {
	username: string;
	firstName?: string;
	lastName?: string;
	status: UserStatus;
	roles: Role[];
	organizations?: string[];
	actions?: IUserAction[];
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

export interface IUserAction {
	id: 'validate' | 'reactivate' | 'deactivate' | 'promote' | 'demote';
	icon: string;
	tooltip: string;
}
