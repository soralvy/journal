import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AiBudgetCheckResult, AiEnvironment, AiUsageLogStatus } from '@repo/database';

import { PrismaService } from '../prisma/prisma.service';
import { AiCostEstimatorService } from './ai-cost-estimator.service';
import { AI_DEFAULT_MODEL } from './ai-model-policy';
import { AiUsageLedgerService, type WriteAiUsageLogInput } from './ai-usage-ledger.service';

type CreateUsageLogInput = {
  data: Record<string, unknown>;
};

const createUsageLogMock = jest.fn<(input: CreateUsageLogInput) => Promise<Record<string, unknown>>>();

const prismaService = {
  aiUsageLog: {
    create: createUsageLogMock,
  },
};

describe('AiUsageLedgerService', () => {
  let service: AiUsageLedgerService;

  beforeEach(() => {
    createUsageLogMock.mockReset();
    createUsageLogMock.mockResolvedValue({ id: 'usage-log-id' });
    service = new AiUsageLedgerService(prismaService as unknown as PrismaService, new AiCostEstimatorService());
  });

  it('writes completed generation usage with calculated cost', async () => {
    await service.writeUsageLog({
      userId: 'user-id',
      threadId: 'thread-id',
      generationId: 'generation-id',
      environment: AiEnvironment.DEMO,
      provider: 'OPENAI',
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
