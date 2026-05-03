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

export class InvalidAiUsageLogInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidAiUsageLogInputError';
  }
}

const estimateUsageCostMicroUsd = (
  usage: AiTokenUsage | undefined,
  provider: AiProviderName | undefined,
  model: string | undefined,
  costEstimator: AiCostEstimatorService,
): number => {
  if (usage === undefined) {
    return 0;
  }

  if (provider === undefined) {
    throw new InvalidAiUsageLogInputError('provider is required when usage is provided.');
  }

  return costEstimator.estimateCostMicroUsd({
    provider,
    model,
    usage,
  });
};

const buildAiUsageLogCreateData = (
  input: WriteAiUsageLogInput,
  costEstimator: AiCostEstimatorService,
): Prisma.AiUsageLogUncheckedCreateInput => {
  const usage = input.usage;

  if (usage !== undefined && input.provider === undefined) {
    throw new InvalidAiUsageLogInputError('provider is required when usage is provided.');
  }

  const estimatedCostMicroUsd = estimateUsageCostMicroUsd(input.usage, input.provider, input.model, costEstimator);

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
