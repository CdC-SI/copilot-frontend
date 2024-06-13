import {HttpClient, HttpParams} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {Observable} from 'rxjs';

@Injectable({
	providedIn: 'root'
})
export class AutocompleteService {
	constructor(private readonly http: HttpClient) {}

	search(requested: string): Observable<any> {
		return this.http.get<any>('/autocomplete/', {params: new HttpParams().set('question', requested)});
	}
}
