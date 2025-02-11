export interface IUser {
	username: string;
	password?: string;
	roles: Role[];
	organizations?: string[];
}

export enum UserFormFields {
	USERNAME = 'username',
	PASSWORD = 'password',
	CONFIRM_PASSWORD = 'confirmPassword',
	ORGANIZATION = 'organization',
	CONFIDENTIALITY = 'confidentiality',
	GCU = 'gcu'
}

export enum LoginFormFields {
	USERNAME = 'username',
	PASSWORD = 'password'
}

export enum Role {
	ADMIN = 'ADMIN',
	USER = 'USER'
}
