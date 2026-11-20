import {ChatTitle} from '../../model/chat-history';

export type ChatHistoryPeriod = 'today' | 'yesterday' | 'last-7-days' | 'older';

export interface ChatHistoryGroup {
	period: ChatHistoryPeriod;
	titles: ChatTitle[];
}

const PERIODS: ChatHistoryPeriod[] = ['today', 'yesterday', 'last-7-days', 'older'];

/** Regroupe les conversations par période (jours calendaires locaux), dans l'ordre reçu ; les groupes vides sont omis. */
export function groupTitlesByPeriod(titles: ChatTitle[] | null | undefined, now = new Date()): ChatHistoryGroup[] {
	// Bornes en jours calendaires locaux (constructeur Date) : correctes aux changements d'heure.
	const boundaries = {today: startOfDay(now, 0), yesterday: startOfDay(now, -1), week: startOfDay(now, -7)};
	const groups = new Map<ChatHistoryPeriod, ChatTitle[]>(PERIODS.map((period): [ChatHistoryPeriod, ChatTitle[]] => [period, []]));
	(titles ?? []).forEach(title => groups.get(periodOf(new Date(title.timestamp).getTime(), boundaries)).push(title));
	return PERIODS.filter(period => groups.get(period).length).map(period => ({period, titles: groups.get(period)}));
}

/** Prochain minuit local, moment où les périodes changent. */
export function nextLocalMidnight(now = new Date()): Date {
	return new Date(startOfDay(now, 1));
}

function startOfDay(date: Date, offsetDays: number): number {
	return new Date(date.getFullYear(), date.getMonth(), date.getDate() + offsetDays).getTime();
}

function periodOf(time: number, boundaries: {today: number; yesterday: number; week: number}): ChatHistoryPeriod {
	if (Number.isNaN(time) || time >= boundaries.today) return 'today';
	if (time >= boundaries.yesterday) return 'yesterday';
	if (time >= boundaries.week) return 'last-7-days';
	return 'older';
}
