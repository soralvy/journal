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
  AiChatCompletionPersistencePrismaClient,
  type AiChatCompletionPersistenceTransactionClient,
  AiChatCompletionPersistenceUsageLedger,
  CompleteAiChatLifecycleInput,
  completeAiChatLifecyclePersistence,
  completeAiChatLifecyclePersistenceInTransaction,
} from './ai-chat-completion-persistence';
import { AI_CHAT_PROMPT_VERSION } from './ai-chat-initial-persistence';
import type { AiChatInitializedResult, ResolvedAiChatLifecycleInput } from './ai-chat-lifecycle.types';
import type { AiProviderGenerateResult } from './ai-provider.port';
import type { AiUsageLogTransactionClient } from './ai-usage-ledger.service';

const messageFindFirstMock = jest.fn<AiChatCompletionPersistenceTransactionClient['aiChatMessage']['findFirst']>();

const messageCreateMock = jest.fn<AiChatCompletionPersistenceTransactionClient['aiChatMessage']['create']>();

const generationUpdateMock = jest.fn<AiChatCompletionPersistenceTransactionClient['aiGeneration']['update']>();

const contextCreateManyMock =
  jest.fn<AiChatCompletionPersistenceTransactionClient['aiJournalContextUse']['createMany']>();

const usageCreateMock = jest.fn<AiUsageLogTransactionClient['aiUsageLog']['create']>();

const threadUpdateMock = jest.fn<AiChatCompletionPersistenceTransactionClient['aiChatThread']['update']>();

const writeUsageLogInTransactionMock = jest.fn<AiChatCompletionPersistenceUsageLedger['writeUsageLogInTransaction']>();

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

type TransactionCallback<T> = (tx: AiChatCompletionPersistenceTransactionClient) => Promise<T>;

const transactionSpy = jest.fn<(callback: TransactionCallback<unknown>) => void>();

const prisma = {
  $transaction: async <T>(callback: TransactionCallback<T>): Promise<T> => {
    transactionSpy(callback);
    return callback(transactionClient);
  },
} satisfies AiChatCompletionPersistencePrismaClient;

const usageLedger = {
  writeUsageLogInTransaction: writeUsageLogInTransactionMock,
} satisfies AiChatCompletionPersistenceUsageLedger;

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
  providerName: 'FAKE',
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

const completedAt = new Date('2026-05-02T12:00:02.000Z');

const baseInput = {
  initialized,
  lifecycleInput,
  providerResult,
  selectedJournalContext: [],
  promptVersion: AI_CHAT_PROMPT_VERSION,
  completedAt,
} satisfies CompleteAiChatLifecycleInput;

const persist = (overrides: Partial<CompleteAiChatLifecycleInput> = {}) => {
  return completeAiChatLifecyclePersistence(prisma, usageLedger, {
    ...baseInput,
    ...overrides,
  });
};

const persistInTransaction = (overrides: Partial<CompleteAiChatLifecycleInput> = {}) => {
  return completeAiChatLifecyclePersistenceInTransaction(transactionClient, usageLedger, {
    ...baseInput,
    ...overrides,
  });
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
    transactionSpy.mockReset();
    messageFindFirstMock.mockReset();
    messageCreateMock.mockReset();
    generationUpdateMock.mockReset();
    contextCreateManyMock.mockReset();
    usageCreateMock.mockReset();
    threadUpdateMock.mockReset();
    writeUsageLogInTransactionMock.mockReset();

    messageFindFirstMock.mockResolvedValue({ sequence: 1 });
    messageCreateMock.mockResolvedValue({ id: 'assistant-message-id', sequence: 2 });
    generationUpdateMock.mockResolvedValue({ id: 'generation-id' });
    contextCreateManyMock.mockResolvedValue({ count: 1 });
    usageCreateMock.mockResolvedValue({
      id: 'usage-log-id',
    } as Awaited<ReturnType<AiUsageLogTransactionClient['aiUsageLog']['create']>>);
    threadUpdateMock.mockResolvedValue({ id: 'thread-id' });
    writeUsageLogInTransactionMock.mockResolvedValue({ id: 'usage-log-id' });
  });

  it('creates the assistant message with the next sequence', async () => {
    await completeAiChatLifecyclePersistence(prisma, usageLedger, baseInput);

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
    await completeAiChatLifecyclePersistence(prisma, usageLedger, {
      initialized,
      lifecycleInput,
      providerResult: {
        ...providerResult,
        text: 'Nice 🙂',
      },
      selectedJournalContext: [],
      promptVersion: AI_CHAT_PROMPT_VERSION,
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

    await completeAiChatLifecyclePersistence(prisma, usageLedger, {
      initialized,
      lifecycleInput,
      providerResult,
      selectedJournalContext: [],
      promptVersion: AI_CHAT_PROMPT_VERSION,
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

    await completeAiChatLifecyclePersistence(prisma, usageLedger, {
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
      promptVersion: AI_CHAT_PROMPT_VERSION,
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
    await completeAiChatLifecyclePersistence(prisma, usageLedger, baseInput);

    expect(contextCreateManyMock).not.toHaveBeenCalled();
  });

  it('writes completed usage through the transaction-aware usage ledger method', async () => {
    await completeAiChatLifecyclePersistence(prisma, usageLedger, baseInput);

    expect(writeUsageLogInTransactionMock).toHaveBeenCalledWith(transactionClient, {
      userId: 'user-id',
      threadId: 'thread-id',
      generationId: 'generation-id',
      environment: AiEnvironment.DEMO,
      providerName: 'FAKE',
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

    await completeAiChatLifecyclePersistence(prisma, usageLedger, {
      initialized,
      lifecycleInput,
      providerResult,
      selectedJournalContext: [],
      promptVersion: AI_CHAT_PROMPT_VERSION,
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
    const result = await completeAiChatLifecyclePersistence(prisma, usageLedger, baseInput);

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

    const result = await completeAiChatLifecyclePersistence(prisma, usageLedger, baseInput);

    expect(result.status).toBe('COMPLETED');
    expect(transactionSpy).toHaveBeenCalledTimes(2);
    expect(messageCreateMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry a P2002 conflict for the wrong unique target', async () => {
    const wrongTargetError = createWrongTargetConflictError();
    messageCreateMock.mockRejectedValue(wrongTargetError);

    await expect(
      completeAiChatLifecyclePersistence(prisma, usageLedger, {
        initialized,
        lifecycleInput,
        providerResult,
        selectedJournalContext: [],
        promptVersion: AI_CHAT_PROMPT_VERSION,
        completedAt: new Date('2026-05-02T12:00:02.000Z'),
      }),
    ).rejects.toBe(wrongTargetError);

    expect(transactionSpy).toHaveBeenCalledTimes(1);
  });

  it('does not retry arbitrary persistence errors', async () => {
    const persistenceError = new Error('database unavailable');
    messageCreateMock.mockRejectedValue(persistenceError);

    await expect(
      completeAiChatLifecyclePersistence(prisma, usageLedger, {
        initialized,
        lifecycleInput,
        providerResult,
        selectedJournalContext: [],
        promptVersion: AI_CHAT_PROMPT_VERSION,
        completedAt: new Date('2026-05-02T12:00:02.000Z'),
      }),
    ).rejects.toBe(persistenceError);

    expect(transactionSpy).toHaveBeenCalledTimes(1);
  });

  it('uses sequence 1 when thread has no previous messages', async () => {
    messageFindFirstMock.mockResolvedValueOnce(null);

    await persistInTransaction();

    expect(messageCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sequence: 1,
        }),
      }),
    );
  });

  it('throws the final sequence conflict when retry is exhausted', async () => {
    const firstError = createSequenceConflictError();
    const secondError = createSequenceConflictError();

    messageCreateMock.mockRejectedValueOnce(firstError).mockRejectedValueOnce(secondError);

    await expect(persist()).rejects.toBe(secondError);

    expect(transactionSpy).toHaveBeenCalledTimes(2);
  });
});
