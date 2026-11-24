import {TestbedHarnessEnvironment} from '@angular/cdk/testing/testbed';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {MatSelectHarness} from '@angular/material/select/testing';
import {provideTranslateService} from '@ngx-translate/core';
import {FeedbackStatus} from '../../../shared/model/feedback';
import {FeedbackStatusSelectComponent} from './feedback-status-select.component';

describe('FeedbackStatusSelectComponent', () => {
	let fixture: ComponentFixture<FeedbackStatusSelectComponent>;
	let component: FeedbackStatusSelectComponent;
	let emitted: FeedbackStatus[];

	beforeEach(() => {
		TestBed.configureTestingModule({imports: [FeedbackStatusSelectComponent], providers: [provideTranslateService()]});
		fixture = TestBed.createComponent(FeedbackStatusSelectComponent);
		component = fixture.componentInstance;
		emitted = [];
		component.statusChange.subscribe(status => emitted.push(status));
		fixture.componentRef.setInput('status', 'NEW');
		fixture.detectChanges();
	});

	it('affiche le statut courant et propose les trois statuts', async () => {
		const select = await TestbedHarnessEnvironment.loader(fixture).getHarness(MatSelectHarness);

		expect(await select.getValueText()).toBe('feedback.status.NEW');
		expect(fixture.nativeElement.querySelector('.status-chip').classList).toContain('status-new');
		await select.open();
		expect((await select.getOptions()).length).toBe(3);
	});

	it('émet le nouveau statut choisi', async () => {
		const select = await TestbedHarnessEnvironment.loader(fixture).getHarness(MatSelectHarness);

		await select.open();
		await select.clickOptions({text: 'feedback.status.TREATED'});

		expect(emitted).toEqual(['TREATED']);
		expect(component.status).toBe('TREATED');
		expect(fixture.nativeElement.querySelector('.status-chip').classList).toContain('status-treated');
	});

	it('n’émet rien si le statut ne change pas', () => {
		component.onChange('NEW');

		expect(emitted).toEqual([]);
	});

	it('se désactive à la demande', async () => {
		fixture.componentRef.setInput('disabled', true);
		const select = await TestbedHarnessEnvironment.loader(fixture).getHarness(MatSelectHarness);

		expect(await select.isDisabled()).toBe(true);
	});
});
