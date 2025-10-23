export type AlertLevel = 'INFO' | 'WARNING';

export interface Alert {
	id: number;
	level: AlertLevel;
	textFr?: string | null;
	textDe?: string | null;
	textIt?: string | null;
	/** LocalDateTime (sans fuseau) attendu par le backend */
	expiresAt?: string | null; // ex: "2025-10-16T23:59:00"
}

/** Pour POST /api/alerts (création) */
export type CreateAlertDTO = Omit<Alert, 'id'>;

/** Pour PUT /api/alerts/{id} (on ne modifie que l’expiration ici) */
export interface UpdateAlertDTO {
	expiresAt?: string | null;
}

export interface AlertView extends Alert {
	/** calcul côté front : true si expiresAt absent ou dans le futur */
	active: boolean;
}
