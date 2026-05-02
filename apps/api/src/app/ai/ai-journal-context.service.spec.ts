import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AiJournalContextSelectionMode } from '@repo/database';

import { PrismaService } from '../prisma/prisma.service';
import {
  AiJournalContextService,
  InvalidJournalContextInputError,
  InvalidJournalContextLimitError,
} from './ai-journal-context.service';
import { extractJournalKeywords } from './journal-keywords';

interface JournalEntryResult {
  id: string;
  content: string;
  createdAt: Date;
}

const findManyMock = jest.fn<() => Promise<JournalEntryResult[]>>();

const prismaService = {
  journalEntry: {
    findMany: findManyMock,
  },
};

const makeEntry = (id: string, content: string, createdAt: string): JournalEntryResult => {
  return {
    id,
    content,
    createdAt: new Date(createdAt),
  };
};

describe('AiJournalContextService', () => {
  const now = new Date('2026-05-02T12:00:00.000Z');
  let service: AiJournalContextService;

  beforeEach(() => {
    findManyMock.mockReset();
    service = new AiJournalContextService(prismaService as unknown as PrismaService);
  });

  it.each([
    ['today', '2026-05-02T00:00:00.000Z', '2026-05-03T00:00:00.000Z', 'matched date reference: today'],
    ['сегодня', '2026-05-02T00:00:00.000Z', '2026-05-03T00:00:00.000Z', 'matched date reference: today'],
    ['сьогодні', '2026-05-02T00:00:00.000Z', '2026-05-03T00:00:00.000Z', 'matched date reference: today'],
    ['yesterday', '2026-05-01T00:00:00.000Z', '2026-05-02T00:00:00.000Z', 'matched date reference: yesterday'],
    ['вчера', '2026-05-01T00:00:00.000Z', '2026-05-02T00:00:00.000Z', 'matched date reference: yesterday'],
    ['вчора', '2026-05-01T00:00:00.000Z', '2026-05-02T00:00:00.000Z', 'matched date reference: yesterday'],
    ['two days ago', '2026-04-30T00:00:00.000Z', '2026-05-01T00:00:00.000Z', 'matched date reference: two days ago'],
    ['2 days ago', '2026-04-30T00:00:00.000Z', '2026-05-01T00:00:00.000Z', 'matched date reference: two days ago'],
    ['два дня назад', '2026-04-30T00:00:00.000Z', '2026-05-01T00:00:00.000Z', 'matched date reference: two days ago'],
    ['2 дня назад', '2026-04-30T00:00:00.000Z', '2026-05-01T00:00:00.000Z', 'matched date reference: two days ago'],
    ['2 дні тому', '2026-04-30T00:00:00.000Z', '2026-05-01T00:00:00.000Z', 'matched date reference: two days ago'],
    ['два дні тому', '2026-04-30T00:00:00.000Z', '2026-05-01T00:00:00.000Z', 'matched date reference: two days ago'],
    ['позавчера', '2026-04-30T00:00:00.000Z', '2026-05-01T00:00:00.000Z', 'matched date reference: two days ago'],
    ['позавчора', '2026-04-30T00:00:00.000Z', '2026-05-01T00:00:00.000Z', 'matched date reference: two days ago'],
    ['last week', '2026-04-25T00:00:00.000Z', '2026-05-02T00:00:00.000Z', 'matched date reference: last week'],
    ['прошлая неделя', '2026-04-25T00:00:00.000Z', '2026-05-02T00:00:00.000Z', 'matched date reference: last week'],
    ['минулого тижня', '2026-04-25T00:00:00.000Z', '2026-05-02T00:00:00.000Z', 'matched date reference: last week'],
  ])(
    'uses DATE_WINDOW for supported date reference "%s"',
    async (message, expectedStart, expectedEnd, expectedReason) => {
      const entry = makeEntry('entry-id', 'Date entry', '2026-05-02T10:00:00.000Z');
      findManyMock.mockResolvedValue([entry]);

      const result = await service.selectJournalContext({
        userId: 'user-id',
        message,
        now,
      });

      expect(findManyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: 'user-id',
            deletedAt: null,
            createdAt: {
              gte: new Date(expectedStart),
              lt: new Date(expectedEnd),
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 10,
          select: {
            id: true,
            content: true,
            createdAt: true,
          },
        }),
      );
      expect(result).toEqual({
        selectionMode: AiJournalContextSelectionMode.DATE_WINDOW,
        selectionReason: expectedReason,
        items: [
          {
            journalEntryId: 'entry-id',
            content: 'Date entry',
            journalEntryCreatedAt: entry.createdAt,
            selectionMode: AiJournalContextSelectionMode.DATE_WINDOW,
            selectionReason: expectedReason,
            rank: 1,
            includedCharCount: 10,
            includedTokenEstimate: 3,
            wasTruncated: false,
          },
        ],
      });
    },
  );

  it('uses date retrieval before keyword retrieval', async () => {
    findManyMock.mockResolvedValue([makeEntry('today-entry', 'Work today', '2026-05-02T10:00:00.000Z')]);

    await service.selectJournalContext({
      userId: 'user-id',
      message: 'today work stress',
      now,
    });

    expect(findManyMock).toHaveBeenCalledTimes(1);
    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.not.objectContaining({
          OR: expect.any(Array),
        }),
      }),
    );
  });

  it('falls back to RECENT when date retrieval has no entries, including exact date prompts', async () => {
    const recentEntry = makeEntry('recent-entry', 'Recent entry', '2026-05-02T09:00:00.000Z');
    findManyMock.mockResolvedValueOnce([]).mockResolvedValueOnce([recentEntry]);

    const result = await service.selectJournalContext({
      userId: 'user-id',
      message: 'yesterday',
      now,
    });

    expect(findManyMock).toHaveBeenCalledTimes(2);
    expect(findManyMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: {
          userId: 'user-id',
          deletedAt: null,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 10,
      }),
    );
    expect(result.selectionMode).toBe(AiJournalContextSelectionMode.RECENT);
    expect(result.selectionReason).toBe('recent journal context fallback');
    expect(result.items[0]?.journalEntryId).toBe('recent-entry');
  });

  it('uses KEYWORD retrieval when no date reference exists', async () => {
    const entry = makeEntry('keyword-entry', 'Work stress was high.', '2026-05-01T10:00:00.000Z');
    findManyMock.mockResolvedValue([entry]);

    const result = await service.selectJournalContext({
      userId: 'user-id',
      message: 'What patterns show up around work stress?',
      now,
    });

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: 'user-id',
          deletedAt: null,
          OR: [
            { content: { contains: 'work', mode: 'insensitive' } },
            { content: { contains: 'stress', mode: 'insensitive' } },
          ],
        },
        take: 50,
        select: {
          id: true,
          content: true,
          createdAt: true,
        },
      }),
    );
    expect(result.selectionMode).toBe(AiJournalContextSelectionMode.KEYWORD);
    expect(result.selectionReason).toBe('matched keywords');
    expect(result.items[0]).toMatchObject({
      journalEntryId: 'keyword-entry',
      selectionMode: AiJournalContextSelectionMode.KEYWORD,
      selectionReason: 'matched keywords',
      includedCharCount: 21,
      includedTokenEstimate: 6,
      wasTruncated: false,
    });
  });

  it('caps keyword candidates at 100', async () => {
    findManyMock.mockResolvedValue([]);

    await service.selectJournalContext({
      userId: 'user-id',
      message: 'work stress focus',
      now,
      maxEntries: 20,
    });

    expect(findManyMock).toHaveBeenNthCalledWith(1, expect.objectContaining({ take: 100 }));
  });

  it('caps extracted keywords so long prompts do not create unbounded keyword OR queries', async () => {
    findManyMock.mockResolvedValue([]);

    await service.selectJournalContext({
      userId: 'user-id',
      message:
        'alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo lima mike november oscar papa quebec',
      now,
    });

    const query = findManyMock.mock.calls[0]?.[0];

    expect(query?.where).toEqual(
      expect.objectContaining({
        OR: [
          { content: { contains: 'alpha', mode: 'insensitive' } },
          { content: { contains: 'bravo', mode: 'insensitive' } },
          { content: { contains: 'charlie', mode: 'insensitive' } },
          { content: { contains: 'delta', mode: 'insensitive' } },
          { content: { contains: 'echo', mode: 'insensitive' } },
          { content: { contains: 'foxtrot', mode: 'insensitive' } },
          { content: { contains: 'golf', mode: 'insensitive' } },
          { content: { contains: 'hotel', mode: 'insensitive' } },
          { content: { contains: 'india', mode: 'insensitive' } },
          { content: { contains: 'juliet', mode: 'insensitive' } },
          { content: { contains: 'kilo', mode: 'insensitive' } },
          { content: { contains: 'lima', mode: 'insensitive' } },
        ],
      }),
    );
  });

  it('falls back to RECENT when keyword candidates have no exact normalized token hits', async () => {
    const recentEntry = makeEntry('recent-entry', 'Recent notes', '2026-05-02T09:00:00.000Z');
    findManyMock
      .mockResolvedValueOnce([makeEntry('false-positive-entry', 'Workout notes', '2026-05-02T10:00:00.000Z')])
      .mockResolvedValueOnce([recentEntry]);

    const result = await service.selectJournalContext({
      userId: 'user-id',
      message: 'work',
      now,
    });

    expect(findManyMock).toHaveBeenCalledTimes(2);
    expect(result.selectionMode).toBe(AiJournalContextSelectionMode.RECENT);
    expect(result.items[0]?.journalEntryId).toBe('recent-entry');
  });

  it('does not treat work as an exact token hit for network', async () => {
    const recentEntry = makeEntry('recent-entry', 'Recent notes', '2026-05-02T09:00:00.000Z');
    findManyMock
      .mockResolvedValueOnce([makeEntry('network-entry', 'Network planning notes', '2026-05-02T10:00:00.000Z')])
      .mockResolvedValueOnce([recentEntry]);

    const result = await service.selectJournalContext({
      userId: 'user-id',
      message: 'work',
      now,
    });

    expect(result.selectionMode).toBe(AiJournalContextSelectionMode.RECENT);
    expect(result.items[0]?.journalEntryId).toBe('recent-entry');
  });

  it('uses RECENT for vague emotional prompts and blank messages', async () => {
    findManyMock.mockResolvedValue([]);

    const vagueResult = await service.selectJournalContext({
      userId: 'user-id',
      message: 'блин, чего ж мне так плохо',
      now,
    });
    const blankResult = await service.selectJournalContext({
      userId: 'user-id',
      message: '   ',
      now,
    });

    expect(vagueResult.selectionMode).toBe(AiJournalContextSelectionMode.RECENT);
    expect(blankResult.selectionMode).toBe(AiJournalContextSelectionMode.RECENT);
    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: 'user-id',
          deletedAt: null,
        },
      }),
    );
  });

  it('validates userId, now, and limits before querying Prisma', async () => {
    await expect(
      service.selectJournalContext({
        userId: ' ',
        message: 'today',
        now,
      }),
    ).rejects.toBeInstanceOf(InvalidJournalContextInputError);

    await expect(
      service.selectJournalContext({
        userId: 'user-id',
        message: 'today',
        now: new Date('invalid'),
      }),
    ).rejects.toBeInstanceOf(InvalidJournalContextInputError);

    await expect(
      service.selectJournalContext({
        userId: 'user-id',
        message: 'today',
        now,
        maxEntries: 21,
      }),
    ).rejects.toBeInstanceOf(InvalidJournalContextLimitError);

    await expect(
      service.selectJournalContext({
        userId: 'user-id',
        message: 'today',
        now,
        maxTotalChars: 20_001,
      }),
    ).rejects.toBeInstanceOf(InvalidJournalContextLimitError);

    expect(findManyMock).not.toHaveBeenCalled();
  });

  it('extracts Unicode keywords, keeps useful 3-character words, and removes stop words', () => {
    expect(extractJournalKeywords('Сон і робота сьогодні, что вокруг работы?')).toEqual([
      'сон',
      'робота',
      'вокруг',
      'работы',
    ]);
  });

  it('ranks by unique keyword hits, total hits, then recency', async () => {
    findManyMock.mockResolvedValue([
      makeEntry('newer-single-hit', 'Stress was present.', '2026-05-02T10:00:00.000Z'),
      makeEntry('older-multi-hit', 'Work stress arrived.', '2026-05-01T10:00:00.000Z'),
      makeEntry('newer-equal-hit', 'Work stress again.', '2026-05-02T09:00:00.000Z'),
      makeEntry('older-more-total-hits', 'Work work stress.', '2026-05-01T11:00:00.000Z'),
    ]);

    const result = await service.selectJournalContext({
      userId: 'user-id',
      message: 'work stress',
      now,
    });

    expect(result.items.map((item) => item.journalEntryId)).toEqual([
      'older-more-total-hits',
      'newer-equal-hit',
      'older-multi-hit',
      'newer-single-hit',
    ]);
  });

  it('enforces max entries and max chars with truncation metadata', async () => {
    findManyMock.mockResolvedValue([
      makeEntry('blank-entry', '   ', '2026-05-02T11:00:00.000Z'),
      makeEntry('oversized-first-entry', '1234567890', '2026-05-02T10:00:00.000Z'),
      makeEntry('skipped-later-entry', 'abcdef', '2026-05-02T09:00:00.000Z'),
      makeEntry('included-later-entry', 'xy', '2026-05-02T08:00:00.000Z'),
    ]);

    const truncatedResult = await service.selectJournalContext({
      userId: 'user-id',
      message: 'today',
      now,
      maxTotalChars: 6,
    });

    expect(truncatedResult.items).toEqual([
      expect.objectContaining({
        journalEntryId: 'oversized-first-entry',
        content: '123456',
        includedCharCount: 6,
        includedTokenEstimate: 2,
        wasTruncated: true,
      }),
    ]);

    findManyMock.mockReset();
    findManyMock.mockResolvedValue([
      makeEntry('included-first-entry', '12345', '2026-05-02T10:00:00.000Z'),
      makeEntry('skipped-later-entry', 'abcdef', '2026-05-02T09:00:00.000Z'),
      makeEntry('included-later-entry', 'xy', '2026-05-02T08:00:00.000Z'),
    ]);

    const skippedResult = await service.selectJournalContext({
      userId: 'user-id',
      message: 'today',
      now,
      maxEntries: 2,
      maxTotalChars: 7,
    });

    expect(skippedResult.items).toEqual([
      expect.objectContaining({
        journalEntryId: 'included-first-entry',
        content: '12345',
        wasTruncated: false,
      }),
      expect.objectContaining({
        journalEntryId: 'included-later-entry',
        content: 'xy',
        rank: 2,
        wasTruncated: false,
      }),
    ]);
  });

  it('keeps retrieval queries scoped and free of non-goal fields', async () => {
    findManyMock.mockResolvedValue([]);

    await service.selectJournalContext({
      userId: 'current-user-id',
      message: 'sleep focus',
      now,
    });

    const query = findManyMock.mock.calls[0]?.[0];

    expect(query).toEqual(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'current-user-id',
          deletedAt: null,
        }),
        select: {
          id: true,
          content: true,
          createdAt: true,
        },
      }),
    );
    expect(JSON.stringify(query)).not.toMatch(/openai|embedding|vector|semantic|redis|stream/i);
  });
});
