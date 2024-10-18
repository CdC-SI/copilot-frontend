export interface IUser {
	username: string;
	password?: string;
	roles: Role[]
}

export enum UserFormFields {
	USERNAME = 'username',
	PASSWORD = 'password',
	CONFIRM_PASSWORD = 'confirmPassword'
}

export enum Role {
	ADMIN,
	USER
}
