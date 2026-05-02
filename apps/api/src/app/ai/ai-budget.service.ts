import { Injectable } from '@nestjs/common';
import { AiBudgetCheckResult, AiEnvironment, AiFeature, AiGenerationStatus } from '@repo/database';

import { PrismaService } from '../prisma/prisma.service';
import {
  AI_ACTIVE_STREAM_CAP_PER_USER,
  AI_DEMO_MONTHLY_BUDGET_MICRO_USD,
  AI_PER_USER_DAILY_REQUEST_CAP,
} from './ai-budget.constants';

export interface AiBudgetDecision {
  allowed: boolean;
  budgetCheckResult: AiBudgetCheckResult;
  safeRefusalReason?: string;
}

export interface CheckAiBudgetInput {
  userId: string;
  environment: AiEnvironment;
  liveCallsEnabled: boolean;
  now?: Date;
}

const createAllowedDecision = (): AiBudgetDecision => ({
  allowed: true,
  budgetCheckResult: AiBudgetCheckResult.ALLOWED,
});

const createRefusedDecision = (
  budgetCheckResult: AiBudgetCheckResult,
  safeRefusalReason: string,
): AiBudgetDecision => ({
  allowed: false,
  budgetCheckResult,
  safeRefusalReason,
});

const getMonthRange = (now: Date): { start: Date; end: Date } => {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  return { start, end };
};

const getDayRange = (now: Date): { start: Date; end: Date } => {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));

  return { start, end };
};

@Injectable()
export class AiBudgetService {
  constructor(private readonly prisma: PrismaService) {}

  async checkBudget(input: CheckAiBudgetInput): Promise<AiBudgetDecision> {
    if (!input.liveCallsEnabled) {
      return createRefusedDecision(AiBudgetCheckResult.LIVE_CALLS_DISABLED, 'Live AI calls are disabled.');
    }

    // Known MVP limitation: this blocks once recorded spend is at or above
    // the cap. One allowed request can slightly exceed the cap until a future
    // max-request-cost preflight exists.
    const now = input.now ?? new Date();
    const monthlySpend = await this.getMonthlyEnvironmentSpendMicroUsd(input.environment, now);

    if (monthlySpend >= AI_DEMO_MONTHLY_BUDGET_MICRO_USD) {
      return createRefusedDecision(
        AiBudgetCheckResult.APP_BUDGET_EXCEEDED,
        'AI chat limit reached for this demo. The monthly AI usage budget has been exhausted.',
      );
    }

    const dailyUserRequestCount = await this.getDailyUserRequestCount(input.userId, now);

    if (dailyUserRequestCount >= AI_PER_USER_DAILY_REQUEST_CAP) {
      return createRefusedDecision(AiBudgetCheckResult.USER_DAILY_LIMIT_EXCEEDED, 'Daily AI request limit reached.');
    }

    const activeGenerationCount = await this.getActiveGenerationCount(input.userId);

    if (activeGenerationCount >= AI_ACTIVE_STREAM_CAP_PER_USER) {
      return createRefusedDecision(
        AiBudgetCheckResult.ACTIVE_STREAM_LIMIT_EXCEEDED,
        'Another AI generation is already active.',
      );
    }

    return createAllowedDecision();
  }

  private async getMonthlyEnvironmentSpendMicroUsd(environment: AiEnvironment, now: Date): Promise<number> {
    const { start, end } = getMonthRange(now);
    const aggregate = await this.prisma.aiUsageLog.aggregate({
      _sum: {
        estimatedCostMicroUsd: true,
      },
      where: {
        environment,
        createdAt: {
          gte: start,
          lt: end,
        },
      },
    });

    return aggregate._sum.estimatedCostMicroUsd ?? 0;
  }

  private async getDailyUserRequestCount(userId: string, now: Date): Promise<number> {
    const { start, end } = getDayRange(now);

    return this.prisma.aiUsageLog.count({
      where: {
        userId,
        feature: AiFeature.JOURNAL_CHAT,
        createdAt: {
          gte: start,
          lt: end,
        },
      },
    });
  }

  private async getActiveGenerationCount(userId: string): Promise<number> {
    return this.prisma.aiGeneration.count({
      where: {
        userId,
        status: {
          in: [AiGenerationStatus.PENDING, AiGenerationStatus.RUNNING],
        },
      },
    });
  }
}
