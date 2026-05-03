import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AiBudgetCheckResult, AiEnvironment, AiGenerationStatus, AiUsageLogStatus } from '@repo/database';

import { failAiChatLifecyclePersistence } from './ai-chat-failure-persistence';
import { AI_CHAT_PROMPT_VERSION } from './ai-chat-initial-persistence';
import type {
  AiChatFailurePersistenceTransactionClient,
  AiChatInitializedResult,
  ResolvedAiChatLifecycleInput,
} from './ai-chat-lifecycle.types';
import type { AiUsageLedgerService, WriteAiUsageLogInput } from './ai-usage-ledger.service';

type TransactionCallback<T> = (tx: typeof transactionClient) => Promise<T>;

const transactionMock = jest.fn(<T>(callback: TransactionCallback<T>) => callback(transactionClient));
const generationUpdateMock = jest.fn<() => Promise<Record<string, unknown>>>();
const usageCreateMock = jest.fn<() => Promise<Record<string, unknown>>>();
const writeUsageLogInTransactionMock =
  jest.fn<
    (tx: AiChatFailurePersistenceTransactionClient, input: WriteAiUsageLogInput) => Promise<Record<string, unknown>>
  >();

const transactionClient = {
  aiGeneration: {
    update: generationUpdateMock,
  },
  aiUsageLog: {
    create: usageCreateMock,
  },
} satisfies AiChatFailurePersistenceTransactionClient;

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

describe('failAiChatLifecyclePersistence', () => {
  beforeEach(() => {
    transactionMock.mockReset();
    generationUpdateMock.mockReset();
    usageCreateMock.mockReset();
    writeUsageLogInTransactionMock.mockReset();

    transactionMock.mockImplementation(<T>(callback: TransactionCallback<T>) => callback(transactionClient));
    generationUpdateMock.mockResolvedValue({ id: 'generation-id' });
    usageCreateMock.mockResolvedValue({ id: 'usage-log-id' });
    writeUsageLogInTransactionMock.mockResolvedValue({ id: 'usage-log-id' });
  });

  it('updates the generation to FAILED with safe error metadata', async () => {
    const failureAt = new Date('2026-05-02T12:00:03.000Z');

    await failAiChatLifecyclePersistence(prisma, usageLedger as unknown as AiUsageLedgerService, {
      initialized,
      lifecycleInput,
      failureAt,
      errorType: 'PROVIDER_ERROR',
      safeErrorMessage: 'AI provider failed to generate a response.',
      requestedModel: 'gpt-5.4-nano',
      promptVersion: AI_CHAT_PROMPT_VERSION,
      provider: 'FAKE',
    });

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
    await failAiChatLifecyclePersistence(prisma, usageLedger as unknown as AiUsageLedgerService, {
      initialized,
      lifecycleInput,
      failureAt: new Date('2026-05-02T12:00:03.000Z'),
      errorType: 'RETRIEVAL_ERROR',
      safeErrorMessage: 'AI chat failed before generating a response.',
      requestedModel: 'gpt-5.4-nano',
      promptVersion: AI_CHAT_PROMPT_VERSION,
      provider: 'FAKE',
    });

    expect(writeUsageLogInTransactionMock).toHaveBeenCalledWith(transactionClient, {
      userId: 'user-id',
      threadId: 'thread-id',
      generationId: 'generation-id',
      environment: AiEnvironment.DEMO,
      provider: 'FAKE',
      model: 'gpt-5.4-nano',
      promptVersion: AI_CHAT_PROMPT_VERSION,
      status: AiUsageLogStatus.FAILED,
      latencyMs: 3000,
      budgetCheckResult: AiBudgetCheckResult.ALLOWED,
      refusalReason: 'AI chat failed before generating a response.',
    });
  });

  it('does not store raw prompt, response, journal content, error message, or stack', async () => {
    await failAiChatLifecyclePersistence(prisma, usageLedger as unknown as AiUsageLedgerService, {
      initialized,
      lifecycleInput: {
        ...lifecycleInput,
        message: 'raw user prompt',
      },
      failureAt: new Date('2026-05-02T12:00:03.000Z'),
      errorType: 'PROVIDER_ERROR',
      safeErrorMessage: 'AI provider failed to generate a response.',
      requestedModel: 'gpt-5.4-nano',
      promptVersion: AI_CHAT_PROMPT_VERSION,
      provider: 'FAKE',
    });
    const storedText = JSON.stringify([generationUpdateMock.mock.calls, writeUsageLogInTransactionMock.mock.calls]);

    expect(storedText).not.toContain('raw user prompt');
    expect(storedText).not.toContain('private journal content');
    expect(storedText).not.toContain('raw provider response');
    expect(storedText).not.toContain('Error:');
  });

  it('returns a minimal FAILED result', async () => {
    const result = await failAiChatLifecyclePersistence(prisma, usageLedger as unknown as AiUsageLedgerService, {
      initialized,
      lifecycleInput,
      failureAt: new Date('2026-05-02T12:00:03.000Z'),
      errorType: 'PROVIDER_ERROR',
      safeErrorMessage: 'AI provider failed to generate a response.',
      requestedModel: 'gpt-5.4-nano',
      promptVersion: AI_CHAT_PROMPT_VERSION,
      provider: 'FAKE',
    });

    expect(result).toEqual({
      status: 'FAILED',
      generationId: 'generation-id',
      safeErrorMessage: 'AI provider failed to generate a response.',
    });
  });
});
