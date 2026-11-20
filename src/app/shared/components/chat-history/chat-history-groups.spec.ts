import {ChatTitle} from '../../model/chat-history';
import {groupTitlesByPeriod} from './chat-history-groups';

describe('groupTitlesByPeriod', () => {
	const now = new Date(2025, 10, 20, 10, 0);
	const title = (conversationId: string, timestamp: Date | string): ChatTitle => ({conversationId, title: conversationId, timestamp: timestamp as Date});

	it('groups titles by calendar period and keeps their order', () => {
		const groups = groupTitlesByPeriod(
			[
				title('a', new Date(2025, 10, 20, 9, 0)),
				title('b', new Date(2025, 10, 20, 0, 0)),
				title('c', new Date(2025, 10, 19, 23, 59)),
				title('d', new Date(2025, 10, 13, 8, 0)),
				title('e', new Date(2025, 10, 12, 23, 0))
			],
			now
		);

		expect(groups.map(group => [group.period, group.titles.map(t => t.conversationId)])).toEqual([
			['today', ['a', 'b']],
			['yesterday', ['c']],
			['last-7-days', ['d']],
			['older', ['e']]
		]);
	});

	it('omits empty periods and accepts ISO strings', () => {
		const groups = groupTitlesByPeriod([title('a', new Date(2025, 9, 1).toISOString())], now);

		expect(groups.map(group => group.period)).toEqual(['older']);
	});

	it('returns no group without titles', () => {
		expect(groupTitlesByPeriod(null, now)).toEqual([]);
	});
});
