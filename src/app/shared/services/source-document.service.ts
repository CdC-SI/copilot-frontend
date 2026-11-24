import {HttpClient} from '@angular/common/http';
import {Injectable, inject} from '@angular/core';
import {ObHttpApiInterceptorEvents} from '@oblique/oblique';
import {Observable, defer} from 'rxjs';
import {ConfigurationService} from '../../core/app-configuration/configuration.service';
import {SourceView} from '../model/source-view';

/**
 * Accès aux sources citées (`/api/source-documents`, contrôle d'accès côté backend). Les erreurs (source supprimée
 * ou inaccessible : 404) sont affichées par le panneau des sources : la notification générique d'Oblique est
 * désactivée pour ces appels.
 */
@Injectable({
	providedIn: 'root'
})
export class SourceDocumentService {
	private readonly config = inject(ConfigurationService);
	private readonly http = inject(HttpClient);
	private readonly interceptorEvents = inject(ObHttpApiInterceptorEvents);

	getView(id: string): Observable<SourceView> {
		return this.withoutNotification(() => this.http.get<SourceView>(this.url(id)));
	}

	getFile(id: string): Observable<Blob> {
		return this.withoutNotification(() => this.http.get(`${this.url(id)}/file`, {responseType: 'blob'}));
	}

	private url(id: string): string {
		return this.config.backendApi(`/source-documents/${encodeURIComponent(id)}`);
	}

	private withoutNotification<T>(request: () => Observable<T>): Observable<T> {
		return defer(() => {
			this.interceptorEvents.deactivateNotificationOnNextAPICalls(1);
			return request();
		});
	}
}
