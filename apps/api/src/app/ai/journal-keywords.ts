import { MAX_JOURNAL_KEYWORDS } from './journal-context.constants';
import type { JournalEntryContextCandidate } from './journal-context.types';

const MIN_KEYWORD_LENGTH = 3;

const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'about',
  'after',
  'again',
  'also',
  'around',
  'because',
  'been',
  'being',
  'can',
  'could',
  'did',
  'does',
  'doing',
  'feel',
  'feeling',
  'for',
  'from',
  'had',
  'has',
  'have',
  'how',
  'into',
  'just',
  'last',
  'like',
  'me',
  'more',
  'my',
  'notice',
  'noticed',
  'of',
  'on',
  'or',
  'patterns',
  'please',
  'really',
  'show',
  'should',
  'so',
  'that',
  'the',
  'their',
  'there',
  'these',
  'thing',
  'things',
  'this',
  'today',
  'was',
  'what',
  'when',
  'where',
  'which',
  'why',
  'with',
  'would',
  'yesterday',
  'а',
  'без',
  'блин',
  'более',
  'будет',
  'буду',
  'бы',
  'был',
  'была',
  'были',
  'было',
  'быть',
  'в',
  'вам',
  'вас',
  'ведь',
  'весь',
  'во',
  'вот',
  'все',
  'да',
  'для',
  'до',
  'его',
  'ее',
  'если',
  'есть',
  'ж',
  'же',
  'за',
  'из',
  'или',
  'как',
  'когда',
  'мне',
  'меня',
  'может',
  'мы',
  'на',
  'надо',
  'не',
  'но',
  'ну',
  'о',
  'об',
  'он',
  'она',
  'они',
  'очень',
  'плохо',
  'по',
  'под',
  'про',
  'с',
  'себя',
  'сегодня',
  'так',
  'то',
  'того',
  'ты',
  'у',
  'уже',
  'что',
  'чего',
  'чтобы',
  'я',
  'без',
  'бо',
  'була',
  'були',
  'було',
  'бути',
  'вже',
  'він',
  'вона',
  'вони',
  'для',
  'до',
  'з',
  'за',
  'і',
  'й',
  'коли',
  'мене',
  'мені',
  'може',
  'на',
  'не',
  'ні',
  'погано',
  'про',
  'сьогодні',
  'так',
  'також',
  'та',
  'те',
  'ти',
  'треба',
  'у',
  'це',
  'цей',
  'чого',
  'що',
  'щоб',
  'як',
  'який',
  'якщо',
]);

export const normalizeJournalText = (text: unknown): string => {
  if (typeof text !== 'string') {
    return '';
  }

  return text?.normalize('NFKC')?.toLowerCase() ?? '';
};

export const tokenizeJournalText = (text: string): string[] => {
  return normalizeJournalText(text).match(/[\p{L}\p{N}]+/gu) ?? [];
};

const isMeaningfulKeyword = (term: unknown): term is string => {
  if (typeof term !== 'string') {
    return false;
  }

  return (term?.length ?? 0) >= MIN_KEYWORD_LENGTH && !STOP_WORDS.has(term);
};

export const extractJournalKeywords = (message: string): string[] => {
  const keywords = tokenizeJournalText(message).filter((term): term is string => {
    return isMeaningfulKeyword(term);
  });

  return [...new Set(keywords)].slice(0, MAX_JOURNAL_KEYWORDS);
};

interface ScoredJournalCandidate {
  candidate: JournalEntryContextCandidate;
  totalHitCount: number;
  uniqueHitCount: number;
}

const scoreJournalCandidate = (
  candidate: JournalEntryContextCandidate,
  keywords: readonly string[],
): ScoredJournalCandidate => {
  const contentTokens = tokenizeJournalText(candidate.content);
  const tokenCounts = new Map<string, number>();

  for (const token of contentTokens) {
    tokenCounts.set(token, (tokenCounts.get(token) ?? 0) + 1);
  }

  let totalHitCount = 0;
  let uniqueHitCount = 0;

  for (const keyword of keywords) {
    const hitCount = tokenCounts.get(keyword) ?? 0;

    if (hitCount > 0) {
      uniqueHitCount += 1;
      totalHitCount += hitCount;
    }
  }

  return {
    candidate,
    totalHitCount,
    uniqueHitCount,
  };
};

export const rankJournalKeywordCandidates = (
  candidates: readonly JournalEntryContextCandidate[],
  keywords: readonly string[],
): JournalEntryContextCandidate[] => {
  return candidates
    .map((candidate) => scoreJournalCandidate(candidate, keywords))
    .filter((scoredCandidate) => scoredCandidate.totalHitCount > 0)
    .toSorted((left, right) => {
      const uniqueHitDifference = right.uniqueHitCount - left.uniqueHitCount;

      if (uniqueHitDifference !== 0) {
        return uniqueHitDifference;
      }

      const totalHitDifference = right.totalHitCount - left.totalHitCount;

      if (totalHitDifference !== 0) {
        return totalHitDifference;
      }

      return right.candidate.createdAt.getTime() - left.candidate.createdAt.getTime();
    })
    .map((scoredCandidate) => scoredCandidate.candidate);
};
