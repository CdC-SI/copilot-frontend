import {TestBed} from '@angular/core/testing';
import {ToolStep} from '../../../model/tool-step';
import {ToolApprovalCardComponent} from './tool-approval-card.component';

describe('ToolApprovalCardComponent', () => {
	const NOW = Date.parse('2030-01-01T00:00:00Z');
	const step = (patch: Partial<ToolStep> = {}): ToolStep => ({
		id: 't1',
		name: 'get_attachment_content',
		arguments: {attachmentId: 'a1', maxChars: 2000},
		status: 'awaiting_approval',
		approval: {approvalId: 'ap1', expiresAt: '2030-01-01T00:00:30Z'},
		...patch
	});

	const create = (value: ToolStep) => {
		TestBed.overrideTemplate(ToolApprovalCardComponent, '');
		const fixture = TestBed.createComponent(ToolApprovalCardComponent);
		fixture.componentRef.setInput('step', value);
		return fixture;
	};

	beforeEach(() => {
		jest.useFakeTimers({now: NOW});
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it('décompte le temps restant puis passe à « expirée » à l’échéance', () => {
		const card = create(step()).componentInstance;

		expect(card.state()).toBe('pending');
		expect(card.secondsLeft()).toBe(30);
		expect(card.args()).toEqual([
			{key: 'attachmentId', value: 'a1'},
			{key: 'maxChars', value: '2000'}
		]);

		jest.advanceTimersByTime(10_000);
		expect(card.secondsLeft()).toBe(20);

		jest.advanceTimersByTime(20_000);
		expect(card.state()).toBe('expired');
	});

	it('n’émet la décision que tant que la demande est en attente', () => {
		const fixture = create(step());
		const decided = jest.fn();
		fixture.componentInstance.decided.subscribe(decided);

		fixture.componentInstance.decide('APPROVE');
		fixture.componentRef.setInput('step', step({approval: {approvalId: 'ap1', expiresAt: '2030-01-01T00:00:30Z', decision: 'APPROVE', sending: true}}));
		fixture.componentInstance.decide('REJECT');

		expect(decided).toHaveBeenCalledTimes(1);
		expect(decided).toHaveBeenCalledWith('APPROVE');
		expect(fixture.componentInstance.state()).toBe('sending');
	});

	it.each([
		[{approval: {approvalId: 'ap1', expiresAt: '2030-01-01T00:00:30Z', decision: 'APPROVE'}}, 'approved'],
		[{approval: {approvalId: 'ap1', expiresAt: '2030-01-01T00:00:30Z', decision: 'REJECT'}}, 'rejected'],
		[{approval: {approvalId: 'ap1', expiresAt: '2030-01-01T00:00:30Z', unavailable: true}}, 'unavailable'],
		[{status: 'ok'}, 'approved'],
		[{status: 'expired'}, 'expired'],
		[{status: 'cancelled'}, 'cancelled'],
		[{status: 'expired', approval: {approvalId: 'ap1', expiresAt: '2030-01-01T00:00:30Z', decision: 'APPROVE', sending: true}}, 'expired'],
		[{status: 'rejected', approval: {approvalId: 'ap1', expiresAt: '2030-01-01T00:00:30Z', unavailable: true}}, 'rejected'],
		[{status: 'ok', approval: {approvalId: 'ap1', expiresAt: '2030-01-01T00:00:30Z', decision: 'APPROVE', sending: true}}, 'approved']
	] as [Partial<ToolStep>, string][])('affiche l’état final %j → %s', (patch, state) => {
		expect(create(step(patch)).componentInstance.state()).toBe(state);
	});
});
