import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AiBudgetCheckResult, AiEnvironment } from '@repo/database';

import { PrismaService } from '../prisma/prisma.service';
import { AI_DEMO_MONTHLY_BUDGET_MICRO_USD, AI_PER_USER_DAILY_REQUEST_CAP } from './ai-budget.constants';
import { AiBudgetService } from './ai-budget.service';

type AggregateResult = Promise<{
  _sum: {
    estimatedCostMicroUsd: number | null;
  };
}>;

const aggregateMock = jest.fn<() => AggregateResult>();
const usageCountMock = jest.fn<() => Promise<number>>();
const generationCountMock = jest.fn<() => Promise<number>>();

const prismaService = {
  aiUsageLog: {
    aggregate: aggregateMock,
    count: usageCountMock,
  },
  aiGeneration: {
    count: generationCountMock,
  },
};

describe('AiBudgetService', () => {
  const now = new Date('2026-05-02T12:00:00.000Z');
  let service: AiBudgetService;

  beforeEach(() => {
    aggregateMock.mockReset();
    usageCountMock.mockReset();
    generationCountMock.mockReset();
    service = new AiBudgetService(prismaService as unknown as PrismaService);
  });

  it('returns LIVE_CALLS_DISABLED without querying usage', async () => {
    await expect(
      service.checkBudget({
        userId: 'user-id',
        environment: AiEnvironment.DEMO,
        liveCallsEnabled: false,
        now,
      }),
    ).resolves.toEqual({
      allowed: false,
      budgetCheckResult: AiBudgetCheckResult.LIVE_CALLS_DISABLED,
      safeRefusalReason: 'Live AI calls are disabled.',
    });

    expect(aggregateMock).not.toHaveBeenCalled();
  });

  it('blocks when monthly environment spend is at the hard budget', async () => {
    aggregateMock.mockResolvedValue({
      _sum: {
        estimatedCostMicroUsd: AI_DEMO_MONTHLY_BUDGET_MICRO_USD,
      },
    });

    await expect(
      service.checkBudget({
        userId: 'user-id',
        environment: AiEnvironment.DEMO,
        liveCallsEnabled: true,
        now,
      }),
    ).resolves.toMatchObject({
      allowed: false,
      budgetCheckResult: AiBudgetCheckResult.APP_BUDGET_EXCEEDED,
    });

    expect(usageCountMock).not.toHaveBeenCalled();
  });

  it('blocks when the user has reached the daily request cap', async () => {
    aggregateMock.mockResolvedValue({
      _sum: {
        estimatedCostMicroUsd: AI_DEMO_MONTHLY_BUDGET_MICRO_USD - 1,
      },
    });
    usageCountMock.mockResolvedValue(AI_PER_USER_DAILY_REQUEST_CAP);

    await expect(
      service.checkBudget({
        userId: 'user-id',
        environment: AiEnvironment.DEMO,
        liveCallsEnabled: true,
        now,
      }),
    ).resolves.toEqual({
      allowed: false,
      budgetCheckResult: AiBudgetCheckResult.USER_DAILY_LIMIT_EXCEEDED,
      safeRefusalReason: 'Daily AI request limit reached.',
    });

    expect(generationCountMock).not.toHaveBeenCalled();
  });

  it('blocks when the user already has an active generation', async () => {
    aggregateMock.mockResolvedValue({
      _sum: {
        estimatedCostMicroUsd: AI_DEMO_MONTHLY_BUDGET_MICRO_USD - 1,
      },
    });
    usageCountMock.mockResolvedValue(AI_PER_USER_DAILY_REQUEST_CAP - 1);
    generationCountMock.mockResolvedValue(1);

    await expect(
      service.checkBudget({
        userId: 'user-id',
        environment: AiEnvironment.DEMO,
        liveCallsEnabled: true,
        now,
      }),
    ).resolves.toEqual({
      allowed: false,
      budgetCheckResult: AiBudgetCheckResult.ACTIVE_STREAM_LIMIT_EXCEEDED,
      safeRefusalReason: 'Another AI generation is already active.',
    });
  });

  it('allows when spend and user request count are below caps', async () => {
    aggregateMock.mockResolvedValue({
      _sum: {
        estimatedCostMicroUsd: AI_DEMO_MONTHLY_BUDGET_MICRO_USD - 1,
      },
    });
    usageCountMock.mockResolvedValue(AI_PER_USER_DAILY_REQUEST_CAP - 1);
    generationCountMock.mockResolvedValue(0);

    await expect(
      service.checkBudget({
        userId: 'user-id',
        environment: AiEnvironment.DEMO,
        liveCallsEnabled: true,
        now,
      }),
    ).resolves.toEqual({
      allowed: true,
      budgetCheckResult: AiBudgetCheckResult.ALLOWED,
    });
  });
});
