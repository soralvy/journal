import { AiJournalContextSelectionMode } from '@repo/database';

import {
  DEFAULT_MAX_ENTRIES,
  DEFAULT_MAX_TOTAL_CHARS,
  MAX_ENTRIES,
  MAX_TOTAL_CHARS,
} from './journal-context.constants';
import { InvalidJournalContextLimitError } from './journal-context.errors';
import type {
  JournalContextLimits,
  JournalEntryContextCandidate,
  SelectedJournalContextItem,
} from './journal-context.types';

const ESTIMATED_CHARS_PER_TOKEN = 4;

const validateLimit = (value: number, name: string, maxValue: number): void => {
  if (!Number.isSafeInteger(value) || value <= 0 || value > maxValue) {
    throw new InvalidJournalContextLimitError(`${name} must be a positive safe integer no greater than ${maxValue}.`);
  }
};

export const validateJournalContextLimits = (
  maxEntries = DEFAULT_MAX_ENTRIES,
  maxTotalChars = DEFAULT_MAX_TOTAL_CHARS,
): JournalContextLimits => {
  validateLimit(maxEntries, 'maxEntries', MAX_ENTRIES);
  validateLimit(maxTotalChars, 'maxTotalChars', MAX_TOTAL_CHARS);

  return {
    maxEntries,
    maxTotalChars,
  };
};

const estimateIncludedTokens = (includedCharCount: number): number => {
  return Math.ceil(includedCharCount / ESTIMATED_CHARS_PER_TOKEN);
};

export const buildJournalContextItems = (
  entries: readonly JournalEntryContextCandidate[],
  selectionMode: AiJournalContextSelectionMode,
  selectionReason: string,
  limits: JournalContextLimits,
): SelectedJournalContextItem[] => {
  const items: SelectedJournalContextItem[] = [];
  let usedChars = 0;

  for (const entry of entries) {
    if (items.length >= limits.maxEntries || usedChars >= limits.maxTotalChars) {
      break;
    }

    if (entry.content.trim().length === 0) {
      continue;
    }

    const remainingChars = limits.maxTotalChars - usedChars;
    const isFirstSelectedItem = items.length === 0;
    const isOversized = entry.content.length > remainingChars;
    const shouldTruncate = isFirstSelectedItem && isOversized;

    if (isOversized && !shouldTruncate) {
      continue;
    }

    const content = shouldTruncate ? entry.content.slice(0, remainingChars) : entry.content;

    if (content?.trim().length === 0) {
      continue;
    }

    const includedCharCount = content?.length;

    usedChars += includedCharCount;

    items.push({
      journalEntryId: entry.id,
      content,
      journalEntryCreatedAt: entry.createdAt,
      selectionMode,
      selectionReason,
      rank: items.length + 1,
      includedCharCount,
      includedTokenEstimate: estimateIncludedTokens(includedCharCount),
      wasTruncated: shouldTruncate,
    });
  }

  return items;
};
