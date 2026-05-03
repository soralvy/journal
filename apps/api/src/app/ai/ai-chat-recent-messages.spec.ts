import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AiChatMessageRole, AiContentRetentionStatus } from '@repo/database';

import { findRecentAiChatMessages } from './ai-chat-recent-messages';

type FindManyInput = {
  where: Record<string, unknown>;
  orderBy: Record<string, unknown>;
  take: number;
  select: Record<string, boolean>;
};

const findManyMock =
  jest.fn<(input: FindManyInput) => Promise<Array<{ role: AiChatMessageRole; content: string | null }>>>();

const prisma = {
  aiChatMessage: {
    findMany: findManyMock,
  },
};

describe('findRecentAiChatMessages', () => {
  beforeEach(() => {
    findManyMock.mockReset();
    findManyMock.mockResolvedValue([]);
  });

  it('queries prior messages for the same user and thread', async () => {
    await findRecentAiChatMessages(prisma, {
      userId: 'user-id',
      threadId: 'thread-id',
      beforeSequence: 7,
    });

    expect(findManyMock).toHaveBeenCalledWith({
      where: {
        userId: 'user-id',
        threadId: 'thread-id',
        sequence: {
          lt: 7,
        },
        contentRetentionStatus: AiContentRetentionStatus.ACTIVE,
        contentDeletedAt: null,
        content: {
          not: null,
        },
      },
      orderBy: {
        sequence: 'desc',
      },
      take: 10,
      select: {
        role: true,
        content: true,
      },
    });
  });

  it('returns DB-descending messages in ascending prompt order', async () => {
    findManyMock.mockResolvedValue([
      { role: AiChatMessageRole.ASSISTANT, content: 'newer answer' },
      { role: AiChatMessageRole.USER, content: 'older question' },
    ]);

    const messages = await findRecentAiChatMessages(prisma, {
      userId: 'user-id',
      threadId: 'thread-id',
      beforeSequence: 7,
    });

    expect(messages).toEqual([
      { role: 'user', content: 'older question' },
      { role: 'assistant', content: 'newer answer' },
    ]);
  });

  it('skips blank content defensively', async () => {
    findManyMock.mockResolvedValue([
      { role: AiChatMessageRole.ASSISTANT, content: '   ' },
      { role: AiChatMessageRole.USER, content: 'useful message' },
    ]);

    const messages = await findRecentAiChatMessages(prisma, {
      userId: 'user-id',
      threadId: 'thread-id',
      beforeSequence: 7,
    });

    expect(messages).toEqual([{ role: 'user', content: 'useful message' }]);
  });

  it('does not return raw Prisma models', async () => {
    findManyMock.mockResolvedValue([{ role: AiChatMessageRole.USER, content: 'hello' }]);

    const messages = await findRecentAiChatMessages(prisma, {
      userId: 'user-id',
      threadId: 'thread-id',
      beforeSequence: 7,
    });

    expect(messages).toEqual([{ role: 'user', content: 'hello' }]);
  });
});
