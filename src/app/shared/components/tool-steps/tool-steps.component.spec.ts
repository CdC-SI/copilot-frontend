import {Component, input, output} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {MatIcon} from '@angular/material/icon';
import {provideTranslateService} from '@ngx-translate/core';
import {ToolApprovalDecision, ToolApprovalRequest, ToolStep} from '../../model/tool-step';
import {ToolApprovalCardComponent} from './tool-approval-card/tool-approval-card.component';
import {ToolStepsComponent} from './tool-steps.component';

@Component({selector: 'mat-icon', template: ''})
class MatIconStubComponent {
	readonly svgIcon = input<string>();
}

@Component({selector: 'zco-tool-approval-card', template: '{{ step().id }}'})
class ToolApprovalCardStubComponent {
	readonly step = input.required<ToolStep>();
	readonly decided = output<ToolApprovalDecision>();
}

describe('ToolStepsComponent', () => {
	let fixture: ComponentFixture<ToolStepsComponent>;
	let component: ToolStepsComponent;

	const step = (id: string, extra: Partial<ToolStep> = {}): ToolStep => ({
		id,
		name: 'search_social_insurance_documentation',
		arguments: {},
		status: 'ok',
		...extra
	});
	const el = (): HTMLElement => fixture.nativeElement;
	const items = (): HTMLElement[] => Array.from(el().querySelectorAll<HTMLElement>('.tool-step'));
	const summary = (): HTMLButtonElement => el().querySelector('.tool-steps-summary');
	const render = (steps: ToolStep[], generating = false): void => {
		fixture.componentRef.setInput('steps', steps);
		fixture.componentRef.setInput('generating', generating);
		fixture.detectChanges();
	};

	beforeEach(() => {
		TestBed.configureTestingModule({imports: [ToolStepsComponent], providers: [provideTranslateService()]});
		TestBed.overrideComponent(ToolStepsComponent, {
			remove: {imports: [MatIcon, ToolApprovalCardComponent]},
			add: {imports: [MatIconStubComponent, ToolApprovalCardStubComponent]}
		});
		fixture = TestBed.createComponent(ToolStepsComponent);
		component = fixture.componentInstance;
	});

	it('affiche une étape unique sans résumé repliable', () => {
		render([step('s1', {durationMs: 420, documentCount: 3})]);

		expect(summary()).toBeNull();
		expect(items()).toHaveLength(1);
		expect(items()[0].dataset['status']).toBe('ok');
		expect(items()[0].classList).toContain('tone-success');
		expect(items()[0].querySelector('.tool-step-name').textContent).toBe('chat.tools.name.search_social_insurance_documentation');
		expect(Array.from(items()[0].querySelectorAll('.tool-step-meta')).map(meta => meta.textContent)).toEqual(['420 ms', 'chat.tools.documents.other']);
	});

	it('plusieurs étapes : dépliées pendant la génération, repliées ensuite, puis selon le choix de l’utilisateur', () => {
		render([step('s1'), step('s2', {status: 'running'})], true);
		expect(summary().getAttribute('aria-expanded')).toBe('true');
		expect(items()).toHaveLength(2);
		expect(el().querySelector('.tool-steps-list').classList).toContain('nested');

		render([step('s1'), step('s2')], false);
		expect(items()).toHaveLength(0);

		summary().click();
		fixture.detectChanges();
		expect(items()).toHaveLength(2);

		render([step('s1'), step('s2')], true);
		summary().click();
		fixture.detectChanges();
		expect(component.expanded()).toBe(false);
	});

	it('indique une étape en attente dans le résumé', () => {
		render([step('s1'), step('s2', {status: 'awaiting_approval'})], true);

		expect(component.pending()).toBe(true);
		expect(summary().querySelector('mat-progress-spinner')).not.toBeNull();
	});

	it.each([
		['running', 'info', 'chat.tools.status.running'],
		['awaiting_approval', 'warning', 'chat.tools.status.awaiting_approval'],
		['no_result', 'info', 'chat.tools.status.no_result'],
		['error', 'warning', 'chat.tools.status.error'],
		['rejected', 'muted', 'chat.tools.status.rejected'],
		['expired', 'muted', 'chat.tools.status.expired'],
		['inconnu', 'info', 'chat.tools.status.other']
	])('statut %s : ton %s et libellé %s', (status, tone, key) => {
		const s = step('s', {status: status as ToolStep['status']});

		expect(component.tone(s)).toBe(tone);
		expect(component.statusKey(s)).toBe(key);
	});

	it('choisit l’icône selon le statut, avec une icône par défaut', () => {
		expect(component.icon(step('s', {status: 'ok'}))).toBe('checkmark_circle');
		expect(component.icon(step('s', {status: 'expired'}))).toBe('clock');
		expect(component.icon(step('s', {status: 'autre' as ToolStep['status']}))).toBe('info_circle');
	});

	it('formate la durée en secondes au-delà d’une seconde et la masque pour une étape en cours', () => {
		expect(component.duration(step('s', {durationMs: 1234}))).toBe('1.2 s');
		expect(component.duration(step('s', {durationMs: 1234, status: 'running'}))).toBeNull();
		expect(component.duration(step('s'))).toBeNull();
	});

	it('accorde le nombre de documents et libelle un outil inconnu de façon générique', () => {
		expect(component.documentsKey(step('s', {documentCount: 1}))).toBe('chat.tools.documents.one');
		expect(component.labelKey(step('s', {name: 'outil_maison'}))).toBe('chat.tools.name.generic');
	});

	it('montre les arguments en info-bulle et rend l’étape focalisable seulement s’il y en a', () => {
		render([step('s1', {arguments: {query: 'rente', limit: 5}}), step('s2')], true);

		expect(component.argumentsText(step('s', {arguments: {query: 'rente', limit: 5}}))).toBe('query : rente · limit : 5');
		expect(items()[0].getAttribute('tabindex')).toBe('0');
		expect(items()[1].hasAttribute('tabindex')).toBe(false);
	});

	it('affiche les cartes d’approbation pendant la génération et relaie la décision', () => {
		const approval = {approvalId: 'ap-1', expiresAt: '2030-01-01T00:00:00Z'};
		const decisions: ToolApprovalRequest[] = [];
		component.approvalDecided.subscribe(request => decisions.push(request));
		render([step('s1', {status: 'awaiting_approval', approval}), step('s2')], true);

		const card = fixture.debugElement.query(d => d.componentInstance instanceof ToolApprovalCardStubComponent)
			.componentInstance as ToolApprovalCardStubComponent;
		card.decided.emit('APPROVE');

		expect(decisions).toEqual([{stepId: 's1', decision: 'APPROVE'}]);

		render([step('s1', {status: 'ok', approval}), step('s2')], false);
		expect(el().querySelector('zco-tool-approval-card')).toBeNull();
	});
});
