import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AiBudgetCheckResult, AiEnvironment, AiGenerationStatus, AiUsageLogStatus } from '@repo/database';

import {
  failAiChatLifecyclePersistence,
  failAiChatLifecyclePersistenceInTransaction,
} from './ai-chat-failure-persistence';
import { AI_CHAT_PROMPT_VERSION } from './ai-chat-initial-persistence';
import type {
  AiChatFailurePersistencePrismaClient,
  AiChatFailurePersistenceTransactionClient,
  AiChatFailurePersistenceUsageLedger,
  AiChatInitializedResult,
  FailAiChatLifecycleInput,
  ResolvedAiChatLifecycleInput,
} from './ai-chat-lifecycle.types';
import type { AiUsageLogTransactionClient } from './ai-usage-ledger.service';

type TransactionCallback<T> = (tx: AiChatFailurePersistenceTransactionClient) => Promise<T>;

const generationUpdateMock = jest.fn<AiChatFailurePersistenceTransactionClient['aiGeneration']['update']>();

const usageCreateMock = jest.fn<AiUsageLogTransactionClient['aiUsageLog']['create']>();

const writeUsageLogInTransactionMock = jest.fn<AiChatFailurePersistenceUsageLedger['writeUsageLogInTransaction']>();

const tx = {
  aiGeneration: {
    update: generationUpdateMock,
  },
  aiUsageLog: {
    create: usageCreateMock,
  },
} satisfies AiChatFailurePersistenceTransactionClient;

const transactionSpy = jest.fn<(callback: TransactionCallback<unknown>) => void>();

const prisma = {
  $transaction: async <T>(callback: TransactionCallback<T>): Promise<T> => {
    transactionSpy(callback);
    return callback(tx);
  },
} satisfies AiChatFailurePersistencePrismaClient;

const usageLedger = {
  writeUsageLogInTransaction: writeUsageLogInTransactionMock,
} satisfies AiChatFailurePersistenceUsageLedger;

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

const failureAt = new Date('2026-05-02T12:00:03.000Z');

const baseInput = {
  initialized,
  lifecycleInput,
  failureAt,
  errorType: 'PROVIDER_ERROR',
  safeErrorMessage: 'AI provider failed to generate a response.',
  requestedModel: 'gpt-5.4-nano',
  promptVersion: AI_CHAT_PROMPT_VERSION,
  providerName: 'FAKE',
} satisfies FailAiChatLifecycleInput;

const persist = (overrides: Partial<FailAiChatLifecycleInput> = {}) => {
  return failAiChatLifecyclePersistence(prisma, usageLedger, {
    ...baseInput,
    ...overrides,
  });
};

const persistInTransaction = (overrides: Partial<FailAiChatLifecycleInput> = {}) => {
  return failAiChatLifecyclePersistenceInTransaction(tx, usageLedger, {
    ...baseInput,
    ...overrides,
  });
};

describe('failAiChatLifecyclePersistence', () => {
  beforeEach(() => {
    transactionSpy.mockReset();
    generationUpdateMock.mockReset();
    usageCreateMock.mockReset();
    writeUsageLogInTransactionMock.mockReset();

    generationUpdateMock.mockResolvedValue({
      id: 'generation-id',
    } as Awaited<ReturnType<AiChatFailurePersistenceTransactionClient['aiGeneration']['update']>>);

    usageCreateMock.mockResolvedValue({
      id: 'usage-log-id',
    } as Awaited<ReturnType<AiUsageLogTransactionClient['aiUsageLog']['create']>>);

    writeUsageLogInTransactionMock.mockResolvedValue({ id: 'usage-log-id' });
  });

  it('updates the generation to FAILED with safe error metadata', async () => {
    await persistInTransaction();

    expect(generationUpdateMock).toHaveBeenCalledWith({
      where: {
        id: 'generation-id',
      },
      data: {
        status: AiGenerationStatus.FAILED,
        completedAt: failureAt,
        latencyMs: 3000,
        errorType: 'PROVIDER_ERROR',
        safeErrorMessage: 'AI provider failed to generate a response.',
      },
    });
  });

  it('writes failed usage through the transaction-aware usage ledger method', async () => {
    await persistInTransaction({
      errorType: 'RETRIEVAL_ERROR',
      safeErrorMessage: 'AI chat failed before generating a response.',
    });

    expect(writeUsageLogInTransactionMock).toHaveBeenCalledWith(tx, {
      userId: 'user-id',
      threadId: 'thread-id',
      generationId: 'generation-id',
      environment: AiEnvironment.DEMO,
      providerName: 'FAKE',
      model: 'gpt-5.4-nano',
      promptVersion: AI_CHAT_PROMPT_VERSION,
      status: AiUsageLogStatus.FAILED,
      latencyMs: 3000,
      budgetCheckResult: AiBudgetCheckResult.ALLOWED,
      refusalReason: 'AI chat failed before generating a response.',
    });
  });

  it('does not persist raw user prompt or unsafe diagnostic details', async () => {
    await persistInTransaction({
      lifecycleInput: {
        ...lifecycleInput,
        message: 'raw user prompt',
      },
      safeErrorMessage: 'Safe user-facing failure message.',
    });

    const persistedPayload = JSON.stringify([
      generationUpdateMock.mock.calls,
      writeUsageLogInTransactionMock.mock.calls,
    ]);

    expect(persistedPayload).not.toContain('raw user prompt');
    expect(persistedPayload).not.toContain('raw provider response');
    expect(persistedPayload).not.toContain('stack');
    expect(persistedPayload).not.toContain('Error:');

    expect(persistedPayload).toContain('Safe user-facing failure message.');
  });

  it('returns a minimal FAILED result', async () => {
    await expect(persistInTransaction()).resolves.toEqual({
      status: 'FAILED',
      generationId: 'generation-id',
      safeErrorMessage: 'AI provider failed to generate a response.',
    });
  });

  it('runs failure persistence inside a transaction', async () => {
    await persist();

    expect(transactionSpy).toHaveBeenCalledTimes(1);
    expect(generationUpdateMock).toHaveBeenCalledTimes(1);
    expect(writeUsageLogInTransactionMock).toHaveBeenCalledTimes(1);
  });

  it('propagates persistence errors without retrying', async () => {
    const error = new Error('database unavailable');

    generationUpdateMock.mockRejectedValueOnce(error);

    await expect(persist()).rejects.toBe(error);

    expect(transactionSpy).toHaveBeenCalledTimes(1);
    expect(writeUsageLogInTransactionMock).not.toHaveBeenCalled();
  });
});
