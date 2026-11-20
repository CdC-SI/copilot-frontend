import {ChatTitle} from '../../model/chat-history';
import {groupTitlesByPeriod, nextLocalMidnight} from './chat-history-groups';

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

	// Europe/Zurich : passage à l'heure d'été le 29.03.2026, à l'heure d'hiver le 25.10.2026 (jours de 23 h et 25 h).
	it('keeps calendar boundaries across daylight saving changes', () => {
		const spring = groupTitlesByPeriod([title('a', new Date(2026, 2, 28, 23, 30))], new Date(2026, 2, 30, 0, 30));
		const autumn = groupTitlesByPeriod([title('b', new Date(2026, 9, 25, 0, 30))], new Date(2026, 9, 26, 23, 30));
		const week = groupTitlesByPeriod([title('c', new Date(2026, 2, 23, 0, 15))], new Date(2026, 2, 30, 10, 0));

		expect(spring.map(group => group.period)).toEqual(['last-7-days']);
		expect(autumn.map(group => group.period)).toEqual(['yesterday']);
		expect(week.map(group => group.period)).toEqual(['last-7-days']);
	});

	it('computes the next local midnight', () => {
		expect(nextLocalMidnight(new Date(2026, 2, 28, 23, 30))).toEqual(new Date(2026, 2, 29));
		expect(nextLocalMidnight(new Date(2026, 11, 31, 8, 0))).toEqual(new Date(2027, 0, 1));
	});

	it('returns no group without titles', () => {
		expect(groupTitlesByPeriod(null, now)).toEqual([]);
	});
});
