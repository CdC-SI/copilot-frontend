import {Language} from '../../shared/model/answer';

export const DEFAULT_CHAT_SUGGESTIONS = [
	{text: 'action_suggestions.translate', action: 'translate'},
	{text: 'action_suggestions.summarize', action: 'summarize'},
	{text: 'action_suggestions.explain', action: 'explain'},
	{text: 'action_suggestions.reformulate', action: 'reformulate'},
	{text: 'action_suggestions.draft', action: 'draft'}
];

export const LANGUAGE_MAP: Record<string, Language> = {de: Language.DE, fr: Language.FR, it: Language.IT};

export const NEW_CHAT_KEY = 'NEW_CHAT';
