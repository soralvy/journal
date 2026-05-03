import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  AiBudgetCheckResult,
  AiChatMessageRole,
  AiContentRetentionStatus,
  AiEnvironment,
  AiGenerationStatus,
  AiJournalContextSelectionMode,
  AiUsageLogStatus,
  Prisma,
} from '@repo/database';

import {
  type AiChatCompletionPersistenceTransactionClient,
  completeAiChatLifecyclePersistence,
} from './ai-chat-completion-persistence';
import type { AiChatInitializedResult } from './ai-chat-initial-persistence';
import { AI_CHAT_PROMPT_VERSION } from './ai-chat-initial-persistence';
import type { ResolvedAiChatLifecycleInput } from './ai-chat-lifecycle-input';
import type { AiProviderGenerateResult } from './ai-provider.port';
import type { AiUsageLedgerService, WriteAiUsageLogInput } from './ai-usage-ledger.service';

type TransactionCallback<T> = (tx: typeof transactionClient) => Promise<T>;

const transactionMock = jest.fn(<T>(callback: TransactionCallback<T>) => callback(transactionClient));
const messageFindFirstMock = jest.fn<() => Promise<{ sequence: number } | null>>();
const messageCreateMock = jest.fn<() => Promise<{ id: string; sequence: number }>>();
const generationUpdateMock = jest.fn<() => Promise<Record<string, unknown>>>();
const contextCreateManyMock = jest.fn<() => Promise<Record<string, unknown>>>();
const usageCreateMock = jest.fn<() => Promise<Record<string, unknown>>>();
const threadUpdateMock = jest.fn<() => Promise<Record<string, unknown>>>();
const writeUsageLogInTransactionMock =
  jest.fn<
    (tx: AiChatCompletionPersistenceTransactionClient, input: WriteAiUsageLogInput) => Promise<Record<string, unknown>>
  >();

const transactionClient = {
  aiChatMessage: {
    findFirst: messageFindFirstMock,
    create: messageCreateMock,
  },
  aiGeneration: {
    update: generationUpdateMock,
  },
  aiJournalContextUse: {
    createMany: contextCreateManyMock,
  },
  aiUsageLog: {
    create: usageCreateMock,
  },
  aiChatThread: {
    update: threadUpdateMock,
  },
} satisfies AiChatCompletionPersistenceTransactionClient;

const prisma = {
  $transaction: transactionMock,
};

const usageLedger = {
  writeUsageLogInTransaction: writeUsageLogInTransactionMock,
};

const initialized: AiChatInitializedResult = {
  status: 'INITIALIZED',
  threadId: 'thread-id',
  userMessageId: 'user-message-id',
  generationId: 'generation-id',
  userMessageSequence: 1,
  lifecycleStartedAt: new Date('2026-05-02T12:00:00.000Z'),
};

const lifecycleInput: ResolvedAiChatLifecycleInput = {
  message: 'hello',
  userId: 'user-id',
  environment: AiEnvironment.DEMO,
  providerCallsEnabled: true,
  lifecycleStartedAt: new Date('2026-05-02T12:00:00.000Z'),
};

const providerResult: AiProviderGenerateResult = {
  provider: 'FAKE',
  model: 'gpt-5.4-nano',
  text: 'Fake assistant response',
  finishReason: 'stop',
  usage: {
    inputTokens: 4,
    cachedInputTokens: 0,
    outputTokens: 2,
    totalTokens: 6,
  },
};

const createSequenceConflictError = (): Prisma.PrismaClientKnownRequestError => {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed on thread message sequence.', {
    code: 'P2002',
    clientVersion: 'test',
    meta: {
      target: ['thread_id', 'sequence'],
    },
  });
};

const createWrongTargetConflictError = (): Prisma.PrismaClientKnownRequestError => {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed on another field.', {
    code: 'P2002',
    clientVersion: 'test',
    meta: {
      target: ['assistant_message_id'],
    },
  });
};

describe('completeAiChatLifecyclePersistence', () => {
  beforeEach(() => {
    transactionMock.mockReset();
    messageFindFirstMock.mockReset();
    messageCreateMock.mockReset();
    generationUpdateMock.mockReset();
    contextCreateManyMock.mockReset();
    usageCreateMock.mockReset();
    threadUpdateMock.mockReset();
    writeUsageLogInTransactionMock.mockReset();

    transactionMock.mockImplementation(<T>(callback: TransactionCallback<T>) => callback(transactionClient));
    messageFindFirstMock.mockResolvedValue({ sequence: 1 });
    messageCreateMock.mockResolvedValue({ id: 'assistant-message-id', sequence: 2 });
    generationUpdateMock.mockResolvedValue({ id: 'generation-id' });
    contextCreateManyMock.mockResolvedValue({ count: 1 });
    usageCreateMock.mockResolvedValue({ id: 'usage-log-id' });
    threadUpdateMock.mockResolvedValue({ id: 'thread-id' });
    writeUsageLogInTransactionMock.mockResolvedValue({ id: 'usage-log-id' });
  });

  it('creates the assistant message with the next sequence', async () => {
    await completeAiChatLifecyclePersistence(prisma, usageLedger as unknown as AiUsageLedgerService, {
      initialized,
      lifecycleInput,
      providerResult,
      selectedJournalContext: [],
      completedAt: new Date('2026-05-02T12:00:02.000Z'),
    });

    expect(messageCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        threadId: 'thread-id',
        userId: 'user-id',
        role: AiChatMessageRole.ASSISTANT,
        content: 'Fake assistant response',
        contentCharCount: 'Fake assistant response'.length,
        sequence: 2,
        contentRetentionStatus: AiContentRetentionStatus.ACTIVE,
      }),
      select: {
        id: true,
        sequence: true,
      },
    });
  });

  it('counts assistant message content by Unicode code point', async () => {
    await completeAiChatLifecyclePersistence(prisma, usageLedger as unknown as AiUsageLedgerService, {
      initialized,
      lifecycleInput,
      providerResult: {
        ...providerResult,
        text: 'Nice 🙂',
      },
      selectedJournalContext: [],
      completedAt: new Date('2026-05-02T12:00:02.000Z'),
    });

    expect(messageCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        content: 'Nice 🙂',
        contentCharCount: 6,
      }),
      select: {
        id: true,
        sequence: true,
      },
    });
  });

  it('updates the generation to COMPLETED and links the assistant message', async () => {
    const completedAt = new Date('2026-05-02T12:00:02.000Z');

    await completeAiChatLifecyclePersistence(prisma, usageLedger as unknown as AiUsageLedgerService, {
      initialized,
      lifecycleInput,
      providerResult,
      selectedJournalContext: [],
      completedAt,
    });

    expect(generationUpdateMock).toHaveBeenCalledWith({
      where: {
        id: 'generation-id',
      },
      data: {
        status: AiGenerationStatus.COMPLETED,
        assistantMessageId: 'assistant-message-id',
        actualModel: 'gpt-5.4-nano',
        finishReason: 'stop',
        completedAt,
        latencyMs: 2000,
        providerResponseId: null,
      },
    });
  });

  it('writes context audit rows without journal content', async () => {
    const journalEntryCreatedAt = new Date('2026-05-01T08:00:00.000Z');

    await completeAiChatLifecyclePersistence(prisma, usageLedger as unknown as AiUsageLedgerService, {
      initialized,
      lifecycleInput,
      providerResult,
      selectedJournalContext: [
        {
          journalEntryId: 'journal-entry-id',
          content: 'private journal content',
          journalEntryCreatedAt,
          selectionMode: AiJournalContextSelectionMode.RECENT,
          selectionReason: 'recent journal context fallback',
          rank: 1,
          includedCharCount: 23,
          includedTokenEstimate: 6,
          wasTruncated: false,
        },
      ],
      completedAt: new Date('2026-05-02T12:00:02.000Z'),
    });

    expect(contextCreateManyMock).toHaveBeenCalledWith({
      data: [
        {
          generationId: 'generation-id',
          userId: 'user-id',
          journalEntryId: 'journal-entry-id',
          selectionMode: AiJournalContextSelectionMode.RECENT,
          selectionReason: 'recent journal context fallback',
          rank: 1,
          includedCharCount: 23,
          includedTokenEstimate: 6,
          journalEntryCreatedAt,
        },
      ],
    });
    expect(JSON.stringify(contextCreateManyMock.mock.calls)).not.toContain('private journal content');
  });

  it('writes no audit rows when retrieval selected no context', async () => {
    await completeAiChatLifecyclePersistence(prisma, usageLedger as unknown as AiUsageLedgerService, {
      initialized,
      lifecycleInput,
      providerResult,
      selectedJournalContext: [],
      completedAt: new Date('2026-05-02T12:00:02.000Z'),
    });

    expect(contextCreateManyMock).not.toHaveBeenCalled();
  });

  it('writes completed usage through the transaction-aware usage ledger method', async () => {
    await completeAiChatLifecyclePersistence(prisma, usageLedger as unknown as AiUsageLedgerService, {
      initialized,
      lifecycleInput,
      providerResult,
      selectedJournalContext: [],
      completedAt: new Date('2026-05-02T12:00:02.000Z'),
    });

    expect(writeUsageLogInTransactionMock).toHaveBeenCalledWith(transactionClient, {
      userId: 'user-id',
      threadId: 'thread-id',
      generationId: 'generation-id',
      environment: AiEnvironment.DEMO,
      provider: 'FAKE',
      model: 'gpt-5.4-nano',
      promptVersion: AI_CHAT_PROMPT_VERSION,
      status: AiUsageLogStatus.COMPLETED,
      usage: providerResult.usage,
      latencyMs: 2000,
      budgetCheckResult: AiBudgetCheckResult.ALLOWED,
    });
  });

  it('updates thread timestamps and retention from completedAt', async () => {
    const completedAt = new Date('2026-05-02T12:00:02.000Z');

    await completeAiChatLifecyclePersistence(prisma, usageLedger as unknown as AiUsageLedgerService, {
      initialized,
      lifecycleInput,
      providerResult,
      selectedJournalContext: [],
      completedAt,
    });

    expect(threadUpdateMock).toHaveBeenCalledWith({
      where: {
        id: 'thread-id',
      },
      data: {
        lastMessageAt: completedAt,
        inactivityBoundaryAt: new Date('2026-05-03T12:00:02.000Z'),
        contentRetentionUntil: new Date('2026-06-01T12:00:02.000Z'),
      },
    });
  });

  it('returns a minimal completed result', async () => {
    const result = await completeAiChatLifecyclePersistence(prisma, usageLedger as unknown as AiUsageLedgerService, {
      initialized,
      lifecycleInput,
      providerResult,
      selectedJournalContext: [],
      completedAt: new Date('2026-05-02T12:00:02.000Z'),
    });

    expect(result).toEqual({
      status: 'COMPLETED',
      threadId: 'thread-id',
      userMessageId: 'user-message-id',
      assistantMessageId: 'assistant-message-id',
      generationId: 'generation-id',
      assistantMessageContent: 'Fake assistant response',
    });
  });

  it('retries a P2002 assistant sequence conflict once', async () => {
    messageCreateMock.mockRejectedValueOnce(createSequenceConflictError());

    const result = await completeAiChatLifecyclePersistence(prisma, usageLedger as unknown as AiUsageLedgerService, {
      initialized,
      lifecycleInput,
      providerResult,
      selectedJournalContext: [],
      completedAt: new Date('2026-05-02T12:00:02.000Z'),
    });

    expect(result.status).toBe('COMPLETED');
    expect(transactionMock).toHaveBeenCalledTimes(2);
    expect(messageCreateMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry a P2002 conflict for the wrong unique target', async () => {
    const wrongTargetError = createWrongTargetConflictError();
    messageCreateMock.mockRejectedValue(wrongTargetError);

    await expect(
      completeAiChatLifecyclePersistence(prisma, usageLedger as unknown as AiUsageLedgerService, {
        initialized,
        lifecycleInput,
        providerResult,
        selectedJournalContext: [],
        completedAt: new Date('2026-05-02T12:00:02.000Z'),
      }),
    ).rejects.toBe(wrongTargetError);

    expect(transactionMock).toHaveBeenCalledTimes(1);
  });

  it('does not retry arbitrary persistence errors', async () => {
    const persistenceError = new Error('database unavailable');
    messageCreateMock.mockRejectedValue(persistenceError);

    await expect(
      completeAiChatLifecyclePersistence(prisma, usageLedger as unknown as AiUsageLedgerService, {
        initialized,
        lifecycleInput,
        providerResult,
        selectedJournalContext: [],
        completedAt: new Date('2026-05-02T12:00:02.000Z'),
      }),
    ).rejects.toBe(persistenceError);

    expect(transactionMock).toHaveBeenCalledTimes(1);
  });
});
