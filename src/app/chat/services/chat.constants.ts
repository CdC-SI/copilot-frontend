import {Language} from '../../shared/model/answer';
import {ActionSuggestion} from './chat-suggestion.service';

export const DEFAULT_CHAT_SUGGESTIONS: ActionSuggestion[] = [];

export const LANGUAGE_MAP: Record<string, Language> = {de: Language.DE, fr: Language.FR, it: Language.IT};

export const NEW_CHAT_KEY = 'NEW_CHAT';
