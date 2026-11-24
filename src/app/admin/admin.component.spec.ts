import {TestbedHarnessEnvironment} from '@angular/cdk/testing/testbed';
import {Component, NgZone, output} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {MatExpansionPanelHarness} from '@angular/material/expansion/testing';
import {By} from '@angular/platform-browser';
import {provideTranslateService} from '@ngx-translate/core';
import {BehaviorSubject} from 'rxjs';
import {refresh} from '../../testing/admin';
import {FeedbackService} from '../shared/services/feedback.service';
import {AdminComponent} from './admin.component';
import {AlertsComponent} from './alerts/alerts.component';
import {DocUploadComponent} from './doc-upload/doc-upload.component';
import {FaqEditComponent} from './faq-edit/faq-edit.component';
import {FeedbackKpiComponent} from './feedback-kpi/feedback-kpi.component';
import {FeedbackReportConfigComponent} from './feedback-kpi/feedback-report-config/feedback-report-config.component';
import {RetentionConfigComponent} from './retention-config/retention-config.component';
import {SourcesComponent} from './sources/sources.component';
import {UserAccountsComponent} from './user-accounts/user-accounts.component';
import {WorkspacesComponent} from './workspaces/workspaces.component';

/** Écrans d'administration remplacés : chacun a sa propre spec, seul le rechargement à l'ouverture est vérifié ici. */
abstract class PanelStub {
	readonly reload = jest.fn();
}

@Component({selector: 'zco-user-accounts', template: ''})
class UserAccountsStubComponent extends PanelStub {}

@Component({selector: 'zco-feedback-kpi', template: ''})
class FeedbackKpiStubComponent extends PanelStub {}

@Component({selector: 'zco-feedback-report-config', template: ''})
class FeedbackReportConfigStubComponent extends PanelStub {}

@Component({selector: 'zco-admin-alerts', template: ''})
class AlertsStubComponent extends PanelStub {}

@Component({selector: 'zco-faq-edit', template: ''})
class FaqEditStubComponent {}

@Component({selector: 'zco-doc-upload', template: ''})
class DocUploadStubComponent {}

@Component({selector: 'zco-retention-config', template: ''})
class RetentionConfigStubComponent extends PanelStub {}

@Component({selector: 'zco-sources', template: ''})
class SourcesStubComponent extends PanelStub {
	readonly expandSourceByName = jest.fn();
}

@Component({selector: 'zco-workspaces', template: ''})
class WorkspacesStubComponent extends PanelStub {
	readonly sourceSelected = output<string>();
}

describe('AdminComponent', () => {
	let fixture: ComponentFixture<AdminComponent>;
	let feedbackService: {newFeedbackCount$: BehaviorSubject<number>; refreshNewFeedbackCount: jest.Mock};
	const element = (): HTMLElement => fixture.nativeElement;
	const stub = <T>(type: new () => T): T => fixture.debugElement.query(By.directive(type))?.componentInstance;
	const panel = async (title: string): Promise<MatExpansionPanelHarness> =>
		TestbedHarnessEnvironment.loader(fixture).getHarness(MatExpansionPanelHarness.with({title: new RegExp(`^${title}`)}));
	const flushMicrotasks = async (): Promise<void> => Promise.resolve();

	beforeEach(() => {
		feedbackService = {newFeedbackCount$: new BehaviorSubject(0), refreshNewFeedbackCount: jest.fn()};
		TestBed.configureTestingModule({
			imports: [AdminComponent],
			providers: [provideTranslateService(), {provide: FeedbackService, useValue: feedbackService}]
		});
		TestBed.overrideComponent(AdminComponent, {
			remove: {
				imports: [
					UserAccountsComponent,
					FeedbackKpiComponent,
					FeedbackReportConfigComponent,
					AlertsComponent,
					FaqEditComponent,
					DocUploadComponent,
					RetentionConfigComponent,
					SourcesComponent,
					WorkspacesComponent
				]
			},
			add: {
				imports: [
					UserAccountsStubComponent,
					FeedbackKpiStubComponent,
					FeedbackReportConfigStubComponent,
					AlertsStubComponent,
					FaqEditStubComponent,
					DocUploadStubComponent,
					RetentionConfigStubComponent,
					SourcesStubComponent,
					WorkspacesStubComponent
				]
			}
		});
		fixture = TestBed.createComponent(AdminComponent);
		refresh(fixture);
	});

	it('rafraîchit le nombre de nouveaux feedbacks et l’affiche en pastille', () => {
		expect(feedbackService.refreshNewFeedbackCount).toHaveBeenCalled();
		expect(element().querySelector('.new-feedback-badge')).toBeNull();

		feedbackService.newFeedbackCount$.next(4);
		refresh(fixture);

		expect(element().querySelector('.new-feedback-badge')?.textContent).toBe('4');
	});

	it('n’instancie les écrans qu’à l’ouverture de leur panneau, sauf FAQ et documents', () => {
		expect(stub(FaqEditStubComponent)).toBeDefined();
		expect(stub(DocUploadStubComponent)).toBeDefined();
		expect(stub(UserAccountsStubComponent)).toBeUndefined();
		expect(stub(SourcesStubComponent)).toBeUndefined();
	});

	it.each([
		['admin.manage.users', UserAccountsStubComponent],
		['admin.manage.feedback', FeedbackKpiStubComponent],
		['admin.manage.feedbackReport', FeedbackReportConfigStubComponent],
		['admin.alerts.panelTitle', AlertsStubComponent],
		['admin.manage.retention', RetentionConfigStubComponent],
		['admin.manage.sources', SourcesStubComponent],
		['admin.manage.workspaces', WorkspacesStubComponent]
	] as [string, new () => PanelStub][])('recharge l’écran %s à l’ouverture de son panneau', async (title, type) => {
		await (await panel(`${title}$`)).expand();
		await flushMicrotasks();

		expect(stub(type).reload).toHaveBeenCalledTimes(1);
	});

	it('ouvre la source choisie dans un workspace dans le panneau des sources, même jamais ouvert', async () => {
		await (await panel('admin.manage.workspaces$')).expand();
		const zoneRun = jest.spyOn(TestBed.inject(NgZone), 'run');

		// Ordre d'une application avec zone : microtâches de l'événement, puis détection des changements.
		stub(WorkspacesStubComponent).sourceSelected.emit('avs');
		await flushMicrotasks();
		refresh(fixture);
		await flushMicrotasks();

		expect(await (await panel('admin.manage.sources$')).isExpanded()).toBe(true);
		expect(stub(SourcesStubComponent).expandSourceByName).toHaveBeenCalledWith('avs');
		// afterNextRender s'exécute hors zone : la requête du détail doit repartir dans la zone (rafraîchissement de la vue).
		expect(zoneRun).toHaveBeenCalled();
	});
});
