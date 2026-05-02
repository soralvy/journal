import { tokenizeJournalText } from './journal-keywords';

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export interface JournalDateWindow {
  start: Date;
  end: Date;
  reason: string;
  matched: boolean;
}

const getUtcDayStart = (date: Date): Date => {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
};

const addUtcDays = (date: Date, days: number): Date => {
  return new Date(date.getTime() + days * MILLISECONDS_PER_DAY);
};

const hasTokenSequence = (tokens: readonly string[], sequence: readonly string[]): boolean => {
  if (sequence.length === 0 || sequence.length > tokens.length) {
    return false;
  }

  const lastStartIndex = tokens.length - sequence.length;

  for (let startIndex = 0; startIndex <= lastStartIndex; startIndex += 1) {
    const hasFullSequence = sequence.every((sequenceToken, sequenceIndex) => {
      return tokens[startIndex + sequenceIndex] === sequenceToken;
    });

    if (hasFullSequence) {
      return true;
    }
  }

  return false;
};

const hasToken = (tokens: readonly string[], expectedToken: string): boolean => {
  return tokens.includes(expectedToken);
};

const createDateWindow = (start: Date, end: Date, reason: string): JournalDateWindow => {
  return {
    start,
    end,
    reason,
    matched: true,
  };
};

const createNoDateWindow = (now: Date): JournalDateWindow => {
  return {
    start: now,
    end: now,
    reason: '',
    matched: false,
  };
};

const getJournalDateWindowCandidates = (message: string, now: Date): JournalDateWindow[] => {
  const tokens = tokenizeJournalText(message);
  const todayStart = getUtcDayStart(now);

  if (hasToken(tokens, 'today') || hasToken(tokens, 'сегодня') || hasToken(tokens, 'сьогодні')) {
    return [createDateWindow(todayStart, addUtcDays(todayStart, 1), 'matched date reference: today')];
  }

  if (hasToken(tokens, 'yesterday') || hasToken(tokens, 'вчера') || hasToken(tokens, 'вчора')) {
    return [createDateWindow(addUtcDays(todayStart, -1), todayStart, 'matched date reference: yesterday')];
  }

  if (
    hasTokenSequence(tokens, ['two', 'days', 'ago']) ||
    hasTokenSequence(tokens, ['2', 'days', 'ago']) ||
    hasTokenSequence(tokens, ['два', 'дня', 'назад']) ||
    hasTokenSequence(tokens, ['2', 'дня', 'назад']) ||
    hasTokenSequence(tokens, ['2', 'дні', 'тому']) ||
    hasTokenSequence(tokens, ['два', 'дні', 'тому']) ||
    hasToken(tokens, 'позавчера') ||
    hasToken(tokens, 'позавчора')
  ) {
    const start = addUtcDays(todayStart, -2);

    return [createDateWindow(start, addUtcDays(start, 1), 'matched date reference: two days ago')];
  }

  if (
    hasTokenSequence(tokens, ['last', 'week']) ||
    hasTokenSequence(tokens, ['прошлая', 'неделя']) ||
    hasTokenSequence(tokens, ['минулого', 'тижня'])
  ) {
    return [createDateWindow(addUtcDays(todayStart, -7), todayStart, 'matched date reference: last week')];
  }

  return [];
};

export const getJournalDateWindow = (message: string, now: Date) => {
  return getJournalDateWindowCandidates(message, now).at(0) ?? createNoDateWindow(now);
};
