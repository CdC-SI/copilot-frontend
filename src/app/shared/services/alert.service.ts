import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable, map} from 'rxjs';
import {Alert, AlertView, CreateAlertDTO, UpdateAlertDTO} from '../model/alerts';
import {ConfigurationService} from '../../core/app-configuration/configuration.service';

@Injectable({providedIn: 'root'})
export class AlertsService {
	constructor(
		private readonly config: ConfigurationService,
		private readonly http: HttpClient
	) {}

	/** GET /api/alerts */
	getAlerts(): Observable<AlertView[]> {
		return this.http.get<Alert[]>(this.config.backendApi('/alerts')).pipe(map(list => list.map(a => ({...a, active: this.isActive(a.expiresAt)}))));
	}

	/** POST /api/alerts */
	createAlert(alert: CreateAlertDTO): Observable<Alert> {
		return this.http.post<Alert>(this.config.backendApi('/alerts'), alert);
	}

	/** PUT /api/alerts/{id} — met à jour l’expiration (réactiver/expirer) */
	setExpiration(id: number, expiresAt: string | null): Observable<Alert> {
		const dto: UpdateAlertDTO = {expiresAt};
		return this.http.put<Alert>(this.config.backendApi(`/alerts/${id}`), dto);
	}

	/** DELETE /api/alerts/{id} — suppression définitive */
	deleteAlert(id: number): Observable<void> {
		return this.http.delete<void>(this.config.backendApi(`/alerts/${id}`));
	}

	private isActive(expiresAt?: string | null): boolean {
		if (!expiresAt) return true;
		return new Date(expiresAt).getTime() > Date.now();
	}
}

/** Formate un LocalDateTime “sans fuseau” (ex: 2025-10-16T23:59:00) */
export function toLocalDateTimeString(d: Date): string {
	const pad = (n: number) => String(n).padStart(2, '0');
	const yyyy = d.getFullYear();
	const MM = pad(d.getMonth() + 1);
	const dd = pad(d.getDate());
	const hh = pad(d.getHours());
	const mm = pad(d.getMinutes());
	const ss = pad(d.getSeconds());
	return `${yyyy}-${MM}-${dd}T${hh}:${mm}:${ss}`;
}
