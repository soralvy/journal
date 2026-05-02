import { Injectable } from '@nestjs/common';
import type { AiEnvironment, AiUsageLog, AiUsageLogStatus, Prisma } from '@repo/database';
import { AiBudgetCheckResult, AiContentRetentionStatus, AiFeature, AiProvider } from '@repo/database';

import { PrismaService } from '../prisma/prisma.service';
import { AiCostEstimatorService } from './ai-cost-estimator.service';
import { type AiProviderName, type AiTokenUsage } from './ai-provider.port';

export interface WriteAiUsageLogInput {
  userId?: string;
  threadId?: string;
  generationId?: string;
  environment: AiEnvironment;
  feature?: AiFeature;
  provider?: AiProviderName;
  model?: string;
  promptVersion?: string;
  status: AiUsageLogStatus;
  usage?: AiTokenUsage;
  latencyMs?: number;
  budgetCheckResult?: AiBudgetCheckResult;
  refusalReason?: string;
  contentRetentionStatus?: AiContentRetentionStatus;
}

type AiUsageLogTransactionClient = Pick<Prisma.TransactionClient, 'aiUsageLog'>;

const mapProvider = (provider: AiProviderName | undefined): AiProvider | undefined => {
  if (provider === undefined) {
    return undefined;
  }

  return provider === 'FAKE' ? AiProvider.FAKE : AiProvider.OPENAI;
};

const getTotalTokens = (usage: AiTokenUsage): number => {
  return usage.totalTokens;
};

const buildAiUsageLogCreateData = (
  input: WriteAiUsageLogInput,
  costEstimator: AiCostEstimatorService,
): Prisma.AiUsageLogUncheckedCreateInput => {
  const usage = input.usage;
  const estimatedCostMicroUsd =
    usage === undefined || input.provider === undefined
      ? 0
      : costEstimator.estimateCostMicroUsd({
          provider: input.provider,
          model: input.model,
          usage,
        });

  return {
    userId: input.userId,
    threadId: input.threadId,
    generationId: input.generationId,
    environment: input.environment,
    feature: input.feature ?? AiFeature.JOURNAL_CHAT,
    provider: mapProvider(input.provider),
    model: input.model,
    promptVersion: input.promptVersion,
    status: input.status,
    inputTokens: usage?.inputTokens ?? 0,
    cachedInputTokens: usage?.cachedInputTokens ?? 0,
    outputTokens: usage?.outputTokens ?? 0,
    reasoningTokens: usage?.reasoningTokens,
    totalTokens: usage === undefined ? 0 : getTotalTokens(usage),
    estimatedCostMicroUsd,
    latencyMs: input.latencyMs,
    budgetCheckResult: input.budgetCheckResult ?? AiBudgetCheckResult.ALLOWED,
    refusalReason: input.refusalReason,
    contentRetentionStatus: input.contentRetentionStatus ?? AiContentRetentionStatus.ACTIVE,
  };
};

@Injectable()
export class AiUsageLedgerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly costEstimator: AiCostEstimatorService,
  ) {}

  async writeUsageLog(input: WriteAiUsageLogInput): Promise<AiUsageLog> {
    return this.prisma.aiUsageLog.create({
      data: buildAiUsageLogCreateData(input, this.costEstimator),
    });
  }

  async writeUsageLogInTransaction(tx: AiUsageLogTransactionClient, input: WriteAiUsageLogInput): Promise<AiUsageLog> {
    return tx.aiUsageLog.create({
      data: buildAiUsageLogCreateData(input, this.costEstimator),
    });
  }
}
