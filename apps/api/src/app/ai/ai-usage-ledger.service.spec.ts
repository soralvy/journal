import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AiBudgetCheckResult, AiEnvironment, AiUsageLog, AiUsageLogStatus } from '@repo/database';

import { AiCostEstimatorService } from './ai-cost-estimator.service';
import { AI_DEFAULT_MODEL } from './ai-model-policy';
import {
  AiUsageLedgerService,
  AiUsageLogTransactionClient,
  InvalidAiUsageLogInputError,
  type WriteAiUsageLogInput,
} from './ai-usage-ledger.service';

type UsageLogCreate = AiUsageLogTransactionClient['aiUsageLog']['create'];

const createUsageLogMock = jest.fn<UsageLogCreate>();
const transactionCreateUsageLogMock = jest.fn<UsageLogCreate>();

const prismaService = {
  aiUsageLog: {
    create: createUsageLogMock,
  },
} satisfies AiUsageLogTransactionClient;

const transactionClient = {
  aiUsageLog: {
    create: transactionCreateUsageLogMock,
  },
} satisfies AiUsageLogTransactionClient;

const createAiUsageLogFixture = (overrides: Partial<AiUsageLog> = {}): AiUsageLog => ({
  id: 'usage-log-id',
  userId: 'user-id',
  threadId: 'thread-id',
  generationId: 'generation-id',
  environment: AiEnvironment.DEMO,
  feature: 'JOURNAL_CHAT',
  provider: null,
  model: 'gpt-5.4-nano',
  promptVersion: 'journal-chat-v1',
  status: AiUsageLogStatus.COMPLETED,
  budgetCheckResult: AiBudgetCheckResult.ALLOWED,
  refusalReason: null,
  inputTokens: 0,
  cachedInputTokens: 0,
  outputTokens: 0,
  totalTokens: 0,
  estimatedCostMicroUsd: 0,
  latencyMs: null,
  createdAt: new Date('2026-05-02T12:00:00.000Z'),
  reasoningTokens: 0,
  contentRetentionStatus: 'ACTIVE',
  contentDeletedAt: new Date('2026-05-02T12:00:00.000Z'),
  anonymizedAt: new Date('2026-05-02T12:00:00.000Z'),
  ...overrides,
});

describe('AiUsageLedgerService', () => {
  let service: AiUsageLedgerService;

  beforeEach(() => {
    createUsageLogMock.mockReset();
    transactionCreateUsageLogMock.mockReset();
    createUsageLogMock.mockResolvedValue(createAiUsageLogFixture());
    transactionCreateUsageLogMock.mockResolvedValue(createAiUsageLogFixture());
    service = new AiUsageLedgerService(prismaService, new AiCostEstimatorService());
  });

  it('writes completed generation usage with calculated cost', async () => {
    await service.writeUsageLog({
      userId: 'user-id',
      threadId: 'thread-id',
      generationId: 'generation-id',
      environment: AiEnvironment.DEMO,
      providerName: 'OPENAI',
      model: AI_DEFAULT_MODEL,
      promptVersion: 'journal-chat-v1',
      status: AiUsageLogStatus.COMPLETED,
      usage: {
        inputTokens: 1000,
        cachedInputTokens: 200,
        outputTokens: 300,
        totalTokens: 1300,
      },
    });

    expect(createUsageLogMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-id',
        threadId: 'thread-id',
        generationId: 'generation-id',
        provider: 'OPENAI',
        model: AI_DEFAULT_MODEL,
        status: AiUsageLogStatus.COMPLETED,
        inputTokens: 1000,
        cachedInputTokens: 200,
        outputTokens: 300,
        totalTokens: 1300,
        estimatedCostMicroUsd: 539,
      }),
    });
  });

  it('writes budget refused usage with zero cost and no provider call metadata', async () => {
    await service.writeUsageLog({
      userId: 'user-id',
      environment: AiEnvironment.DEMO,
      status: AiUsageLogStatus.BUDGET_REFUSED,
      budgetCheckResult: AiBudgetCheckResult.APP_BUDGET_EXCEEDED,
      refusalReason: 'AI chat limit reached for this demo.',
    });

    expect(createUsageLogMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-id',
        threadId: undefined,
        generationId: undefined,
        provider: undefined,
        model: undefined,
        status: AiUsageLogStatus.BUDGET_REFUSED,
        inputTokens: 0,
        cachedInputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        estimatedCostMicroUsd: 0,
        budgetCheckResult: AiBudgetCheckResult.APP_BUDGET_EXCEEDED,
        refusalReason: 'AI chat limit reached for this demo.',
      }),
    });
  });

  it('writes fake provider usage with zero cost', async () => {
    await service.writeUsageLog({
      userId: 'user-id',
      threadId: 'thread-id',
      generationId: 'generation-id',
      environment: AiEnvironment.DEMO,
      providerName: 'FAKE',
      model: 'gpt-5.4-nano',
      promptVersion: 'journal-chat-v1',
      status: AiUsageLogStatus.COMPLETED,
      usage: {
        inputTokens: 3,
        cachedInputTokens: 0,
        outputTokens: 1,
        totalTokens: 4,
      },
    });

    expect(createUsageLogMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        provider: 'FAKE',
        inputTokens: 3,
        outputTokens: 1,
        totalTokens: 4,
        estimatedCostMicroUsd: 0,
      }),
    });
  });

  it('rejects token usage when provider is missing', async () => {
    await expect(
      service.writeUsageLog({
        userId: 'user-id',
        threadId: 'thread-id',
        generationId: 'generation-id',
        environment: AiEnvironment.DEMO,
        model: AI_DEFAULT_MODEL,
        promptVersion: 'journal-chat-v1',
        status: AiUsageLogStatus.FAILED,
        usage: {
          inputTokens: 1,
          cachedInputTokens: 0,
          outputTokens: 0,
          totalTokens: 1,
        },
      }),
    ).rejects.toBeInstanceOf(InvalidAiUsageLogInputError);

    expect(createUsageLogMock).not.toHaveBeenCalled();
  });

  it('writes usage through a transaction client', async () => {
    await service.writeUsageLogInTransaction(transactionClient, {
      userId: 'user-id',
      threadId: 'thread-id',
      generationId: 'generation-id',
      environment: AiEnvironment.DEMO,
      providerName: 'FAKE',
      model: 'gpt-5.4-nano',
      promptVersion: 'journal-chat-v1',
      status: AiUsageLogStatus.COMPLETED,
      usage: {
        inputTokens: 2,
        cachedInputTokens: 0,
        outputTokens: 1,
        totalTokens: 3,
      },
    });

    expect(createUsageLogMock).not.toHaveBeenCalled();
    expect(transactionCreateUsageLogMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-id',
        threadId: 'thread-id',
        generationId: 'generation-id',
        provider: 'FAKE',
        status: AiUsageLogStatus.COMPLETED,
        inputTokens: 2,
        outputTokens: 1,
        totalTokens: 3,
        estimatedCostMicroUsd: 0,
      }),
    });
  });

  it('uses equivalent create data for normal and transaction writes', async () => {
    const input = {
      userId: 'user-id',
      threadId: 'thread-id',
      generationId: 'generation-id',
      environment: AiEnvironment.DEMO,
      providerName: 'OPENAI' as const,
      model: AI_DEFAULT_MODEL,
      promptVersion: 'journal-chat-v1',
      status: AiUsageLogStatus.COMPLETED,
      usage: {
        inputTokens: 1000,
        cachedInputTokens: 200,
        outputTokens: 300,
        totalTokens: 1300,
      },
    };

    await service.writeUsageLog(input);
    await service.writeUsageLogInTransaction(transactionClient, input);

    expect(transactionCreateUsageLogMock.mock.calls[0]?.[0].data).toEqual(createUsageLogMock.mock.calls[0]?.[0].data);
  });

  it('does not store prompt, response, or journal content fields', async () => {
    const input: WriteAiUsageLogInput & {
      journalContent: string;
      prompt: string;
      response: string;
    } = {
      userId: 'user-id',
      environment: AiEnvironment.DEMO,
      status: AiUsageLogStatus.RATE_LIMIT_REFUSED,
      budgetCheckResult: AiBudgetCheckResult.USER_DAILY_LIMIT_EXCEEDED,
      refusalReason: 'Daily AI request limit reached.',
      prompt: 'private prompt',
      response: 'private response',
      journalContent: 'private journal content',
    };

    await service.writeUsageLog(input);

    const createInput = createUsageLogMock.mock.calls[0]?.[0];

    expect(createInput?.data).not.toHaveProperty('prompt');
    expect(createInput?.data).not.toHaveProperty('response');
    expect(createInput?.data).not.toHaveProperty('journalContent');
  });
});
