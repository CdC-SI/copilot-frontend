import {ChatTitle} from '../../model/chat-history';

export type ChatHistoryPeriod = 'today' | 'yesterday' | 'last-7-days' | 'older';

export interface ChatHistoryGroup {
	period: ChatHistoryPeriod;
	titles: ChatTitle[];
}

const PERIODS: ChatHistoryPeriod[] = ['today', 'yesterday', 'last-7-days', 'older'];
const DAY_MS = 24 * 60 * 60 * 1000;

/** Regroupe les conversations par période (jours calendaires locaux), dans l'ordre reçu ; les groupes vides sont omis. */
export function groupTitlesByPeriod(titles: ChatTitle[] | null | undefined, now = new Date()): ChatHistoryGroup[] {
	const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
	const groups = new Map<ChatHistoryPeriod, ChatTitle[]>(PERIODS.map((period): [ChatHistoryPeriod, ChatTitle[]] => [period, []]));
	(titles ?? []).forEach(title => groups.get(periodOf(new Date(title.timestamp).getTime(), startOfToday)).push(title));
	return PERIODS.filter(period => groups.get(period).length).map(period => ({period, titles: groups.get(period)}));
}

function periodOf(time: number, startOfToday: number): ChatHistoryPeriod {
	if (Number.isNaN(time) || time >= startOfToday) return 'today';
	if (time >= startOfToday - DAY_MS) return 'yesterday';
	if (time >= startOfToday - 7 * DAY_MS) return 'last-7-days';
	return 'older';
}
