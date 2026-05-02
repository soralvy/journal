import { Injectable } from '@nestjs/common';
import { AiJournalContextSelectionMode } from '@repo/database';

import { PrismaService } from '../prisma/prisma.service';
import { KEYWORD_CANDIDATE_MULTIPLIER, MAX_KEYWORD_CANDIDATES } from './journal-context.constants';
import { InvalidJournalContextInputError } from './journal-context.errors';
import {
  type JournalContextLimits,
  type JournalEntryContextCandidate,
  type SelectJournalContextInput,
  type SelectJournalContextResult,
} from './journal-context.types';
import { buildJournalContextItems, validateJournalContextLimits } from './journal-context-budget';
import { getJournalDateWindow, type JournalDateWindow } from './journal-date-window';
import { extractJournalKeywords, rankJournalKeywordCandidates } from './journal-keywords';

const RECENT_SELECTION_REASON = 'recent journal context fallback';
const KEYWORD_SELECTION_REASON = 'matched keywords';

const isValidDate = (date: unknown): date is Date => {
  return date instanceof Date && Number.isFinite(date.getTime());
};

const resolveNow = (now: Date | undefined): Date => {
  if (now === undefined) {
    return new Date();
  }

  if (!isValidDate(now)) {
    throw new InvalidJournalContextInputError('now must be a valid Date.');
  }

  return now;
};

const validateUserId = (userId: string): void => {
  const trimmedUserId = userId?.trim() ?? '';

  if (trimmedUserId === '') {
    throw new InvalidJournalContextInputError('userId must be non-empty.');
  }
};

@Injectable()
export class AiJournalContextService {
  constructor(private readonly prisma: PrismaService) {}

  async selectJournalContext(input: SelectJournalContextInput): Promise<SelectJournalContextResult> {
    validateUserId(input.userId);
    const limits = validateJournalContextLimits(input.maxEntries, input.maxTotalChars);
    const now = resolveNow(input.now);

    if (input.message.trim().length === 0) {
      return this.selectRecentContext(input.userId, limits);
    }

    const dateWindow = getJournalDateWindow(input.message, now);

    if (dateWindow.matched) {
      const dateWindowResult = await this.selectDateWindowContext(input.userId, dateWindow, limits);

      if (dateWindowResult.items.length > 0) {
        return dateWindowResult;
      }

      return this.selectRecentContext(input.userId, limits);
    }

    const keywords = extractJournalKeywords(input.message);

    if (keywords.length > 0) {
      const keywordResult = await this.selectKeywordContext(input.userId, keywords, limits);

      if (keywordResult.items.length > 0) {
        return keywordResult;
      }
    }

    return this.selectRecentContext(input.userId, limits);
  }

  private async selectDateWindowContext(
    userId: string,
    dateWindow: JournalDateWindow,
    limits: JournalContextLimits,
  ): Promise<SelectJournalContextResult> {
    const entries = await this.findDateWindowEntries(userId, dateWindow, limits.maxEntries);
    const items = buildJournalContextItems(
      entries,
      AiJournalContextSelectionMode.DATE_WINDOW,
      dateWindow.reason,
      limits,
    );

    return {
      selectionMode: AiJournalContextSelectionMode.DATE_WINDOW,
      selectionReason: dateWindow.reason,
      items,
    };
  }

  private async selectKeywordContext(
    userId: string,
    keywords: readonly string[],
    limits: JournalContextLimits,
  ): Promise<SelectJournalContextResult> {
    const candidateLimit = Math.min(limits.maxEntries * KEYWORD_CANDIDATE_MULTIPLIER, MAX_KEYWORD_CANDIDATES);
    const candidates = await this.findKeywordCandidates(userId, keywords, candidateLimit);
    const rankedCandidates = rankJournalKeywordCandidates(candidates, keywords);
    const items = buildJournalContextItems(
      rankedCandidates,
      AiJournalContextSelectionMode.KEYWORD,
      KEYWORD_SELECTION_REASON,
      limits,
    );

    return {
      selectionMode: AiJournalContextSelectionMode.KEYWORD,
      selectionReason: KEYWORD_SELECTION_REASON,
      items,
    };
  }

  private async selectRecentContext(userId: string, limits: JournalContextLimits): Promise<SelectJournalContextResult> {
    const entries = await this.findRecentEntries(userId, limits.maxEntries);
    const items = buildJournalContextItems(
      entries,
      AiJournalContextSelectionMode.RECENT,
      RECENT_SELECTION_REASON,
      limits,
    );

    return {
      selectionMode: AiJournalContextSelectionMode.RECENT,
      selectionReason: RECENT_SELECTION_REASON,
      items,
    };
  }

  private async findDateWindowEntries(
    userId: string,
    dateWindow: JournalDateWindow,
    maxEntries: number,
  ): Promise<JournalEntryContextCandidate[]> {
    return this.prisma.journalEntry.findMany({
      where: {
        userId,
        deletedAt: null,
        createdAt: {
          gte: dateWindow.start,
          lt: dateWindow.end,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: maxEntries,
      select: {
        id: true,
        content: true,
        createdAt: true,
      },
    });
  }

  private async findKeywordCandidates(
    userId: string,
    keywords: readonly string[],
    candidateLimit: number,
  ): Promise<JournalEntryContextCandidate[]> {
    return this.prisma.journalEntry.findMany({
      where: {
        userId,
        deletedAt: null,
        OR: keywords.map((keyword) => ({
          content: {
            contains: keyword,
            mode: 'insensitive',
          },
        })),
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: candidateLimit,
      select: {
        id: true,
        content: true,
        createdAt: true,
      },
    });
  }

  private async findRecentEntries(userId: string, maxEntries: number): Promise<JournalEntryContextCandidate[]> {
    return this.prisma.journalEntry.findMany({
      where: {
        userId,
        deletedAt: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: maxEntries,
      select: {
        id: true,
        content: true,
        createdAt: true,
      },
    });
  }
}

export { InvalidJournalContextInputError, InvalidJournalContextLimitError } from './journal-context.errors';
export type {
  SelectedJournalContextItem,
  SelectJournalContextInput,
  SelectJournalContextResult,
} from './journal-context.types';
