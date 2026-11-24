import {ComponentFixture, TestBed} from '@angular/core/testing';
import {TranslateService, provideTranslateService} from '@ngx-translate/core';
import {BehaviorSubject, Subject, of, throwError} from 'rxjs';
import {Alert} from '../../model/alerts';
import {IUser, UserStatus} from '../../model/user';
import {AlertsService} from '../../services/alert.service';
import {AuthenticationServiceV2} from '../../services/auth.service';
import {provideTestIcons} from '../../../../testing/shared-components';
import {AlertBannerComponent} from './alert-banner.component';

describe('AlertBannerComponent', () => {
	let fixture: ComponentFixture<AlertBannerComponent>;
	let component: AlertBannerComponent;
	let user$: BehaviorSubject<IUser>;
	let alertsService: {getActiveAlerts: jest.Mock};
	let translate: TranslateService;

	const el = (): HTMLElement => fixture.nativeElement;
	const banners = (): HTMLElement[] => Array.from(el().querySelectorAll('.alert-banner'));
	const anAlert = (alert: Partial<Alert> = {}): Alert => ({id: 1, level: 'INFO', textFr: 'Maintenance', textDe: 'Wartung', textIt: 'Manutenzione', ...alert});
	const activeUser = {status: UserStatus.ACTIVE} as IUser;

	beforeEach(() => {
		sessionStorage.clear();
		user$ = new BehaviorSubject<IUser>(null);
		alertsService = {getActiveAlerts: jest.fn(() => of([anAlert(), anAlert({id: 2, level: 'WARNING', textFr: 'Panne'})]))};
		TestBed.configureTestingModule({
			imports: [AlertBannerComponent],
			providers: [
				provideTranslateService({lang: 'fr'}),
				provideTestIcons(),
				{provide: AlertsService, useValue: alertsService},
				{provide: AuthenticationServiceV2, useValue: {$authenticatedUser: user$}}
			]
		});
		translate = TestBed.inject(TranslateService);
		fixture = TestBed.createComponent(AlertBannerComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('ne charge les alertes qu’une fois l’utilisateur actif', () => {
		user$.next({status: UserStatus.PENDING_ACTIVATION} as IUser);

		expect(alertsService.getActiveAlerts).not.toHaveBeenCalled();
		expect(el().querySelector('.alert-banner-container')).toBeNull();

		user$.next(activeUser);
		fixture.detectChanges();

		expect(alertsService.getActiveAlerts).toHaveBeenCalledTimes(1);
		expect(banners().map(banner => banner.querySelector('.alert-banner-text').textContent)).toEqual(['Maintenance', 'Panne']);
	});

	it('ne recharge plus les alertes après sa destruction', () => {
		fixture.destroy();

		user$.next(activeUser);

		expect(alertsService.getActiveAlerts).not.toHaveBeenCalled();
	});

	it('distingue les alertes d’information et d’avertissement', () => {
		user$.next(activeUser);
		fixture.detectChanges();

		const [info, warning] = banners();
		expect(info.classList).toContain('alert-banner-info');
		expect(info.classList).not.toContain('alert-banner-warning');
		expect(info.querySelector('mat-icon').getAttribute('data-mat-icon-name')).toBe('info_circle');
		expect(warning.classList).toContain('alert-banner-warning');
		expect(warning.querySelector('mat-icon').getAttribute('data-mat-icon-name')).toBe('exclamation_triangle');
		expect(info.querySelector('button').getAttribute('aria-label')).toBe('alert.close');
	});

	it('masque une alerte fermée et s’en souvient pour la session', () => {
		user$.next(activeUser);
		fixture.detectChanges();

		banners()[0].querySelector('button').click();
		fixture.detectChanges();

		expect(banners()).toHaveLength(1);
		expect(JSON.parse(sessionStorage.getItem('dismissedAlerts'))).toEqual([1]);

		component.loadActiveAlerts();
		fixture.detectChanges();
		expect(component.alerts.map(alert => alert.id)).toEqual([2]);
	});

	it('n’enregistre pas deux fois la même alerte fermée', () => {
		sessionStorage.setItem('dismissedAlerts', '[1]');

		component.dismiss(anAlert());

		expect(JSON.parse(sessionStorage.getItem('dismissedAlerts'))).toEqual([1]);
	});

	it('affiche le texte dans la langue courante, le français par défaut', () => {
		const alert = anAlert();
		const lang = jest.spyOn(translate, 'getCurrentLang');

		const textIn = (code: string): string => {
			lang.mockReturnValue(code);
			return component.getAlertText(alert);
		};

		expect(['fr', 'de', 'it', 'en'].map(textIn)).toEqual(['Maintenance', 'Wartung', 'Manutenzione', 'Maintenance']);
	});

	it('se rabat sur le texte par défaut traduit si le texte manque', () => {
		const lang = jest.spyOn(translate, 'getCurrentLang');

		lang.mockReturnValue('de');
		expect(component.getAlertText(anAlert({textDe: null}))).toBe('alert.default.text');
		lang.mockReturnValue('it');
		expect(component.getAlertText(anAlert({textIt: undefined}))).toBe('alert.default.text');
		lang.mockReturnValue('fr');
		expect(component.getAlertText(anAlert({textFr: ' alert.default.text '}))).toBe('alert.default.text');
		lang.mockReturnValue('rm');
		expect(component.getAlertText(anAlert({textFr: ''}))).toBe('alert.default.text');
	});

	it('journalise l’échec du chargement sans afficher de bandeau', () => {
		const error = new Error('KO');
		alertsService.getActiveAlerts.mockReturnValue(throwError(() => error));

		user$.next(activeUser);
		fixture.detectChanges();

		expect(console.error).toHaveBeenCalledWith('Failed to load active alerts', error);
		expect(banners()).toHaveLength(0);
	});

	it('abandonne le chargement en cours à la destruction', () => {
		const pending = new Subject<Alert[]>();
		alertsService.getActiveAlerts.mockReturnValue(pending);
		user$.next(activeUser);

		fixture.destroy();
		pending.next([anAlert()]);

		expect(component.alerts).toEqual([]);
		expect(pending.observed).toBe(false);
	});
});
