import {Injectable} from '@angular/core';
import {IFaqItem} from '../model/faq';
import {HttpClient} from '@angular/common/http';
import {ConfigurationService} from '../../core/app-configuration/configuration.service';
import {Observable} from 'rxjs';
import { IUser } from "../model/user";

@Injectable({
	providedIn: 'root'
})
export class UserService {
	constructor(
		private readonly http: HttpClient,
		private readonly config: ConfigurationService
	) {}

	createAccount(user: IUser): Observable<any> {
		const headers = {'Content-Type': 'application/json', Accept: 'application/json'};
		return this.http.post(this.config.javaBackendApi('/users'), user, {headers});
	}
}
