import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  AiBudgetCheckResult,
  AiChatMessageRole,
  AiEnvironment,
  AiGenerationStatus,
  AiJournalContextSelectionMode,
  AiUsageLogStatus,
} from '@repo/database';

import { PrismaService } from '../prisma/prisma.service';
import { type AiBudgetDecision, AiBudgetService, type CheckAiBudgetInput } from './ai-budget.service';
import { AiChatLifecycleService } from './ai-chat-lifecycle.service';
import {
  countAiChatMessageCodePoints,
  InvalidAiChatInputError,
  resolveAiChatLifecycleInput,
} from './ai-chat-lifecycle-input';
import { AiJournalContextService } from './ai-journal-context.service';
import { AI_DEFAULT_MODEL, AI_MAX_OUTPUT_TOKENS } from './ai-model-policy';
import type { AiProviderGenerateInput, AiProviderGenerateResult, AiProviderPort } from './ai-provider.port';
import { AiUsageLedgerService, type WriteAiUsageLogInput } from './ai-usage-ledger.service';

type TransactionCallback<T> = (tx: typeof transactionClient) => Promise<T>;

const checkBudgetMock = jest.fn<(input: CheckAiBudgetInput) => Promise<AiBudgetDecision>>();
const writeUsageLogMock = jest.fn<(input: WriteAiUsageLogInput) => Promise<Record<string, unknown>>>();
const writeUsageLogInTransactionMock =
  jest.fn<(tx: typeof transactionClient, input: WriteAiUsageLogInput) => Promise<Record<string, unknown>>>();
const selectJournalContextMock = jest.fn<() => Promise<Record<string, unknown>>>();
const providerGenerateMock = jest.fn<(input: AiProviderGenerateInput) => Promise<AiProviderGenerateResult>>();
const transactionMock = jest.fn(<T>(callback: TransactionCallback<T>) => callback(transactionClient));
const threadUpdateManyMock = jest.fn<(args: unknown) => Promise<Record<string, unknown>>>();
const threadFindFirstMock = jest.fn<(args: unknown) => Promise<{ id: string } | null>>();
const threadCreateMock = jest.fn<(args: unknown) => Promise<{ id: string }>>();
const threadUpdateMock = jest.fn<(args: unknown) => Promise<Record<string, unknown>>>();
const messageFindFirstMock = jest.fn<(args: unknown) => Promise<{ sequence: number } | null>>();
const messageFindManyMock =
  jest.fn<(args: unknown) => Promise<Array<{ role: AiChatMessageRole; content: string | null }>>>();
const messageCreateMock = jest.fn<(args: unknown) => Promise<{ id: string; sequence: number }>>();
const generationCreateMock = jest.fn<(args: unknown) => Promise<{ id: string }>>();
const generationUpdateMock = jest.fn<(args: unknown) => Promise<Record<string, unknown>>>();
const contextCreateManyMock = jest.fn<(args: unknown) => Promise<Record<string, unknown>>>();
const usageCreateMock = jest.fn<(args: unknown) => Promise<Record<string, unknown>>>();

const transactionClient = {
  aiChatThread: {
    updateMany: threadUpdateManyMock,
    findFirst: threadFindFirstMock,
    create: threadCreateMock,
    update: threadUpdateMock,
  },
  aiChatMessage: {
    findFirst: messageFindFirstMock,
    create: messageCreateMock,
  },
  aiGeneration: {
    create: generationCreateMock,
    update: generationUpdateMock,
  },
  aiJournalContextUse: {
    createMany: contextCreateManyMock,
  },
  aiUsageLog: {
    create: usageCreateMock,
  },
};

const prismaService = {
  $transaction: transactionMock,
  aiChatMessage: {
    findMany: messageFindManyMock,
  },
};

const allowedDecision: AiBudgetDecision = {
  allowed: true,
  budgetCheckResult: AiBudgetCheckResult.ALLOWED,
};

const createRefusedDecision = (
  budgetCheckResult: AiBudgetCheckResult,
  safeRefusalReason = 'safe refusal reason',
): AiBudgetDecision => ({
  allowed: false,
  budgetCheckResult,
  safeRefusalReason,
});

const getBudgetInput = (): CheckAiBudgetInput => {
  expect(checkBudgetMock).toHaveBeenCalledTimes(1);
  const firstCall = checkBudgetMock.mock.calls[0];

  if (firstCall === undefined) {
    throw new Error('Expected checkBudget to be called.');
  }

  return firstCall[0];
};

const getUsageLogInput = (): WriteAiUsageLogInput => {
  expect(writeUsageLogMock).toHaveBeenCalledTimes(1);
  const firstCall = writeUsageLogMock.mock.calls[0];

  if (firstCall === undefined) {
    throw new Error('Expected writeUsageLog to be called.');
  }

  return firstCall[0];
};

const getTransactionUsageLogInput = (): WriteAiUsageLogInput => {
  expect(writeUsageLogInTransactionMock).toHaveBeenCalledTimes(1);

  const firstCall = writeUsageLogInTransactionMock.mock.calls[0];

  if (firstCall === undefined) {
    throw new Error('Expected writeUsageLogInTransaction to be called.');
  }

  return firstCall[1];
};

describe('AiChatLifecycleService', () => {
  let service: AiChatLifecycleService;
  let inTransaction = false;
  let providerCalledInsideTransaction = false;
  let operationEvents: string[] = [];

  beforeEach(() => {
    checkBudgetMock.mockReset();
    writeUsageLogMock.mockReset();
    writeUsageLogInTransactionMock.mockReset();
    selectJournalContextMock.mockReset();
    providerGenerateMock.mockReset();
    transactionMock.mockReset();
    threadUpdateManyMock.mockReset();
    threadFindFirstMock.mockReset();
    threadCreateMock.mockReset();
    threadUpdateMock.mockReset();
    messageFindFirstMock.mockReset();
    messageFindManyMock.mockReset();
    messageCreateMock.mockReset();
    generationCreateMock.mockReset();
    generationUpdateMock.mockReset();
    contextCreateManyMock.mockReset();
    usageCreateMock.mockReset();
    inTransaction = false;
    providerCalledInsideTransaction = false;
    operationEvents = [];

    checkBudgetMock.mockResolvedValue(allowedDecision);
    writeUsageLogMock.mockResolvedValue({ id: 'usage-log-id' });
    writeUsageLogInTransactionMock.mockResolvedValue({ id: 'completion-usage-log-id' });
    selectJournalContextMock.mockResolvedValue({
      selectionMode: AiJournalContextSelectionMode.RECENT,
      selectionReason: 'recent journal context fallback',
      items: [
        {
          journalEntryId: 'journal-entry-id',
          content: 'private journal content',
          journalEntryCreatedAt: new Date('2026-05-01T08:00:00.000Z'),
          selectionMode: AiJournalContextSelectionMode.RECENT,
          selectionReason: 'recent journal context fallback',
          rank: 1,
          includedCharCount: 23,
          includedTokenEstimate: 6,
          wasTruncated: false,
        },
      ],
    });
    providerGenerateMock.mockImplementation((input) => {
      providerCalledInsideTransaction = inTransaction;
      operationEvents.push('provider');

      return Promise.resolve({
        providerName: 'FAKE',
        model: input.model,
        text: 'Fake assistant response',
        finishReason: 'stop',
        usage: {
          inputTokens: input.messages.length,
          cachedInputTokens: 0,
          outputTokens: 2,
          totalTokens: input.messages.length + 2,
        },
      });
    });
    transactionMock.mockImplementation(async <T>(callback: TransactionCallback<T>) => {
      operationEvents.push('transaction:start');
      inTransaction = true;

      try {
        return await callback(transactionClient);
      } finally {
        inTransaction = false;
        operationEvents.push('transaction:end');
      }
    });
    threadUpdateManyMock.mockResolvedValue({ count: 0 });
    threadFindFirstMock.mockResolvedValue(null);
    threadCreateMock.mockResolvedValue({ id: 'thread-new' });
    threadUpdateMock.mockResolvedValue({ id: 'thread-new' });
    messageFindFirstMock.mockResolvedValueOnce(null).mockResolvedValue({ sequence: 1 });
    messageFindManyMock.mockResolvedValue([{ role: AiChatMessageRole.USER, content: 'recent user message' }]);
    messageCreateMock
      .mockResolvedValueOnce({ id: 'user-message-id', sequence: 1 })
      .mockResolvedValue({ id: 'assistant-message-id', sequence: 2 });
    generationCreateMock.mockResolvedValue({ id: 'generation-id' });
    generationUpdateMock.mockResolvedValue({ id: 'generation-id' });
    contextCreateManyMock.mockResolvedValue({ count: 1 });
    usageCreateMock.mockResolvedValue({ id: 'usage-log-id' });

    service = new AiChatLifecycleService(
      prismaService as unknown as PrismaService,
      { checkBudget: checkBudgetMock } as unknown as AiBudgetService,
      {
        writeUsageLog: writeUsageLogMock,
        writeUsageLogInTransaction: writeUsageLogInTransactionMock,
      } as unknown as AiUsageLedgerService,
      { selectJournalContext: selectJournalContextMock } as unknown as AiJournalContextService,
      { generate: providerGenerateMock } as unknown as AiProviderPort,
    );
  });

  it('resolves input before checking budget', async () => {
    const now = new Date('2026-05-02T12:00:00.000Z');

    await service.submitMessage({
      message: '  hello  ',
      environment: AiEnvironment.TEST,
      providerCallsEnabled: false,
      now,
      userId: ' user-id ',
    });

    expect(getBudgetInput()).toEqual({
      userId: 'user-id',
      environment: AiEnvironment.TEST,
      liveCallsEnabled: false,
      now,
    });
  });

  it('rejects invalid input before budget is checked', async () => {
    await expect(
      service.submitMessage({
        message: '   ',
        environment: AiEnvironment.DEMO,
        providerCallsEnabled: true,
        userId: 'user-id',
      }),
    ).rejects.toBeInstanceOf(InvalidAiChatInputError);

    expect(checkBudgetMock).not.toHaveBeenCalled();
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it('writes refusal usage and skips persistence/provider work when budget is refused', async () => {
    const now = new Date('2026-05-02T12:00:00.000Z');
    checkBudgetMock.mockResolvedValue(
      createRefusedDecision(AiBudgetCheckResult.APP_BUDGET_EXCEEDED, 'budget exhausted'),
    );

    const result = await service.submitMessage({
      message: 'hello',
      environment: AiEnvironment.DEMO,
      providerCallsEnabled: true,
      now,
      userId: 'user-id',
    });

    expect(result).toEqual({
      status: 'REFUSED',
      userId: 'user-id',
      budgetCheckResult: AiBudgetCheckResult.APP_BUDGET_EXCEEDED,
      refusalReason: 'budget exhausted',
      lifecycleStartedAt: now,
    });
    expect(getUsageLogInput()).toEqual({
      userId: 'user-id',
      environment: AiEnvironment.DEMO,
      status: AiUsageLogStatus.BUDGET_REFUSED,
      budgetCheckResult: AiBudgetCheckResult.APP_BUDGET_EXCEEDED,
      refusalReason: 'budget exhausted',
    });
    expect(writeUsageLogMock).toHaveBeenCalledTimes(1);
    expect(transactionMock).not.toHaveBeenCalled();
    expect(threadUpdateManyMock).not.toHaveBeenCalled();
    expect(threadFindFirstMock).not.toHaveBeenCalled();
    expect(threadCreateMock).not.toHaveBeenCalled();
    expect(messageCreateMock).not.toHaveBeenCalled();
    expect(generationCreateMock).not.toHaveBeenCalled();
    expect(selectJournalContextMock).not.toHaveBeenCalled();
    expect(messageFindManyMock).not.toHaveBeenCalled();
    expect(providerGenerateMock).not.toHaveBeenCalled();
  });

  it('calls retrieval with userId, trimmed message, and lifecycleStartedAt', async () => {
    const now = new Date('2026-05-02T12:00:00.000Z');

    await service.submitMessage({
      message: '  hello  ',
      environment: AiEnvironment.DEMO,
      providerCallsEnabled: true,
      now,
      userId: ' user-id ',
    });

    expect(selectJournalContextMock).toHaveBeenCalledWith({
      userId: 'user-id',
      message: 'hello',
      now,
    });
  });

  it('fetches recent messages excluding the current user message', async () => {
    await service.submitMessage({
      message: 'hello',
      environment: AiEnvironment.DEMO,
      providerCallsEnabled: true,
      userId: 'user-id',
    });

    expect(messageFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'user-id',
          threadId: 'thread-new',
          sequence: {
            lt: 1,
          },
        }),
      }),
    );
  });

  it('assembles the prompt and calls the provider through the provider port', async () => {
    await service.submitMessage({
      message: 'hello',
      environment: AiEnvironment.DEMO,
      providerCallsEnabled: true,
      userId: 'user-id',
    });

    expect(providerGenerateMock).toHaveBeenCalledWith({
      messages: [
        expect.objectContaining({ role: 'system' }),
        expect.objectContaining({
          role: 'system',
          content: expect.stringContaining('private journal content'),
        }),
        { role: 'user', content: 'recent user message' },
        { role: 'user', content: 'hello' },
      ],
      model: AI_DEFAULT_MODEL,
      maxOutputTokens: AI_MAX_OUTPUT_TOKENS,
    });
  });

  it('calls provider after the initial transaction and before completion transaction', async () => {
    await service.submitMessage({
      message: 'hello',
      environment: AiEnvironment.DEMO,
      providerCallsEnabled: true,
      userId: 'user-id',
    });

    expect(operationEvents).toEqual([
      'transaction:start',
      'transaction:end',
      'provider',
      'transaction:start',
      'transaction:end',
    ]);
    expect(providerCalledInsideTransaction).toBe(false);
  });

  it('returns a COMPLETED result on successful fake provider lifecycle', async () => {
    const result = await service.submitMessage({
      message: 'hello',
      environment: AiEnvironment.DEMO,
      providerCallsEnabled: true,
      userId: 'user-id',
    });

    expect(result).toEqual({
      status: 'COMPLETED',
      threadId: 'thread-new',
      userMessageId: 'user-message-id',
      assistantMessageId: 'assistant-message-id',
      generationId: 'generation-id',
      assistantMessageContent: 'Fake assistant response',
    });
  });

  it('writes usage log input without prompt or journal content', async () => {
    await service.submitMessage({
      message: 'hello',
      environment: AiEnvironment.DEMO,
      providerCallsEnabled: true,
      userId: 'user-id',
    });

    const usageLogInput = getTransactionUsageLogInput();
    const usageLogText = JSON.stringify(usageLogInput);

    expect(usageLogInput).toEqual(
      expect.objectContaining({
        userId: 'user-id',
        threadId: 'thread-new',
        generationId: 'generation-id',
        environment: AiEnvironment.DEMO,
        providerName: 'FAKE',
        model: AI_DEFAULT_MODEL,
        promptVersion: 'journal-chat-v1',
        status: AiUsageLogStatus.COMPLETED,
        budgetCheckResult: AiBudgetCheckResult.ALLOWED,
      }),
    );
    expect(usageLogText).not.toContain('private journal content');
    expect(usageLogText).not.toContain('recent user message');
    expect(usageLogText).not.toContain('hello');
  });

  it('returns FAILED and persists failure when retrieval fails', async () => {
    selectJournalContextMock.mockRejectedValue(new Error('raw retrieval failure'));

    const result = await service.submitMessage({
      message: 'hello',
      environment: AiEnvironment.DEMO,
      providerCallsEnabled: true,
      userId: 'user-id',
    });

    expect(result).toEqual({
      status: 'FAILED',
      generationId: 'generation-id',
      safeErrorMessage: 'AI chat failed before generating a response.',
    });
    expect(generationUpdateMock).toHaveBeenCalledWith({
      where: {
        id: 'generation-id',
      },
      data: expect.objectContaining({
        status: AiGenerationStatus.FAILED,
        errorType: 'RETRIEVAL_ERROR',
        safeErrorMessage: 'AI chat failed before generating a response.',
      }),
    });
    expect(getTransactionUsageLogInput()).toEqual(
      expect.objectContaining({
        providerName: 'FAKE',
        model: AI_DEFAULT_MODEL,
        promptVersion: 'journal-chat-v1',
        status: AiUsageLogStatus.FAILED,
        budgetCheckResult: AiBudgetCheckResult.ALLOWED,
        refusalReason: 'AI chat failed before generating a response.',
      }),
    );
    expect(providerGenerateMock).not.toHaveBeenCalled();
    expect(messageCreateMock).toHaveBeenCalledTimes(1);
  });

  it('returns FAILED and skips provider when recent message fetch fails', async () => {
    messageFindManyMock.mockRejectedValue(new Error('raw recent failure'));

    const result = await service.submitMessage({
      message: 'hello',
      environment: AiEnvironment.DEMO,
      providerCallsEnabled: true,
      userId: 'user-id',
    });

    expect(result).toEqual({
      status: 'FAILED',
      generationId: 'generation-id',
      safeErrorMessage: 'AI chat failed before generating a response.',
    });
    expect(generationUpdateMock).toHaveBeenCalledWith({
      where: {
        id: 'generation-id',
      },
      data: expect.objectContaining({
        status: AiGenerationStatus.FAILED,
        errorType: 'RECENT_MESSAGES_ERROR',
      }),
    });
    expect(providerGenerateMock).not.toHaveBeenCalled();
    expect(messageCreateMock).toHaveBeenCalledTimes(1);
  });

  it('returns FAILED and skips provider when prompt assembly fails', async () => {
    selectJournalContextMock.mockResolvedValue({
      selectionMode: AiJournalContextSelectionMode.RECENT,
      selectionReason: 'recent journal context fallback',
      items: [
        {
          journalEntryId: 'journal-entry-id',
          content: 'context',
          journalEntryCreatedAt: null,
          selectionMode: AiJournalContextSelectionMode.RECENT,
          selectionReason: 'recent journal context fallback',
          rank: 1,
          includedCharCount: 7,
          includedTokenEstimate: 2,
          wasTruncated: false,
        },
      ],
    });

    const result = await service.submitMessage({
      message: 'hello',
      environment: AiEnvironment.DEMO,
      providerCallsEnabled: true,
      userId: 'user-id',
    });

    expect(result).toEqual({
      status: 'FAILED',
      generationId: 'generation-id',
      safeErrorMessage: 'AI chat failed before generating a response.',
    });
    expect(generationUpdateMock).toHaveBeenCalledWith({
      where: {
        id: 'generation-id',
      },
      data: expect.objectContaining({
        status: AiGenerationStatus.FAILED,
        errorType: 'PROMPT_ASSEMBLY_ERROR',
      }),
    });
    expect(providerGenerateMock).not.toHaveBeenCalled();
    expect(messageCreateMock).toHaveBeenCalledTimes(1);
  });

  it('returns FAILED and persists failure when provider fails without retrying provider', async () => {
    providerGenerateMock.mockRejectedValue(new Error('raw provider failure'));

    const result = await service.submitMessage({
      message: 'hello',
      environment: AiEnvironment.DEMO,
      providerCallsEnabled: true,
      userId: 'user-id',
    });

    expect(result).toEqual({
      status: 'FAILED',
      generationId: 'generation-id',
      safeErrorMessage: 'AI provider failed to generate a response.',
    });
    expect(generationUpdateMock).toHaveBeenCalledWith({
      where: {
        id: 'generation-id',
      },
      data: expect.objectContaining({
        status: AiGenerationStatus.FAILED,
        errorType: 'PROVIDER_ERROR',
        safeErrorMessage: 'AI provider failed to generate a response.',
      }),
    });
    expect(getTransactionUsageLogInput()).toEqual(
      expect.objectContaining({
        providerName: 'FAKE',
        model: AI_DEFAULT_MODEL,
        promptVersion: 'journal-chat-v1',
        status: AiUsageLogStatus.FAILED,
        refusalReason: 'AI provider failed to generate a response.',
      }),
    );
    expect(providerGenerateMock).toHaveBeenCalledTimes(1);
    expect(messageCreateMock).toHaveBeenCalledTimes(1);
    expect(contextCreateManyMock).not.toHaveBeenCalled();
  });

  it('rejects non-boolean providerCallsEnabled', () => {
    expect(() =>
      resolveAiChatLifecycleInput({
        message: 'hello',
        userId: 'user-id',
        environment: AiEnvironment.DEMO,
        providerCallsEnabled: 'true' as unknown as boolean,
      }),
    ).toThrow(InvalidAiChatInputError);
  });

  it('rejects invalid environment', () => {
    expect(() =>
      resolveAiChatLifecycleInput({
        message: 'hello',
        userId: 'user-id',
        environment: 'NOPE' as AiEnvironment,
        providerCallsEnabled: true,
      }),
    ).toThrow(InvalidAiChatInputError);
  });

  it('clones provided now date', () => {
    const now = new Date('2026-05-02T12:00:00.000Z');

    const resolved = resolveAiChatLifecycleInput({
      message: 'hello',
      userId: 'user-id',
      environment: AiEnvironment.DEMO,
      providerCallsEnabled: true,
      now,
    });

    expect(resolved.lifecycleStartedAt).toEqual(now);
    expect(resolved.lifecycleStartedAt).not.toBe(now);
  });

  it('counts Unicode code points instead of UTF-16 code units', () => {
    expect(countAiChatMessageCodePoints('🙂')).toBe(1);
  });
});
