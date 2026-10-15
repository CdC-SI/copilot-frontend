import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {ConfigurationService} from '../../core/app-configuration/configuration.service';
import {CatalogImportReport} from '../model/catalog';

@Injectable({providedIn: 'root'})
export class CatalogService {
	private readonly CATALOG_URL = '/admin/catalog';

	constructor(
		private readonly config: ConfigurationService,
		private readonly http: HttpClient
	) {}

	/** POST /api/admin/catalog/import : crée ou met à jour les sources et workspaces décrits dans le fichier YAML. */
	import(file: File): Observable<CatalogImportReport> {
		const formData = new FormData();
		formData.append('file', file, file.name);
		return this.http.post<CatalogImportReport>(this.config.backendApi(`${this.CATALOG_URL}/import`), formData);
	}

	/** GET /api/admin/catalog/export : catalogue courant au format YAML. */
	export(): Observable<Blob> {
		return this.http.get(this.config.backendApi(`${this.CATALOG_URL}/export`), {responseType: 'blob'});
	}
}
