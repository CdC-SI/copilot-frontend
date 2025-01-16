export interface IUser {
	username: string;
	password?: string;
	roles: Role[];
}

export enum UserFormFields {
	USERNAME = 'username',
	PASSWORD = 'password',
	CONFIRM_PASSWORD = 'confirmPassword',
	ORGANIZATION = 'organization'
}

export enum LoginFormFields {
	USERNAME = 'username',
	PASSWORD = 'password'
}

export enum Role {
	ADMIN = 'ADMIN',
	USER = 'USER'
}
