import { Injectable } from '@nestjs/common';
import {
  AiBudgetCheckResult,
  AiContentRetentionStatus,
  AiEnvironment,
  AiFeature,
  AiProvider,
  AiUsageLog,
  AiUsageLogStatus,
} from '@repo/database';

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

const mapProvider = (provider: AiProviderName | undefined): AiProvider | undefined => {
  if (provider === undefined) {
    return undefined;
  }

  return provider === 'FAKE' ? AiProvider.FAKE : AiProvider.OPENAI;
};

const getTotalTokens = (usage: AiTokenUsage): number => {
  return usage.totalTokens;
};

@Injectable()
export class AiUsageLedgerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly costEstimator: AiCostEstimatorService,
  ) {}

  async writeUsageLog(input: WriteAiUsageLogInput): Promise<AiUsageLog> {
    const usage = input.usage;
    const estimatedCostMicroUsd =
      usage === undefined || input.provider === undefined
        ? 0
        : this.costEstimator.estimateCostMicroUsd({
            provider: input.provider,
            model: input.model,
            usage,
          });

    return this.prisma.aiUsageLog.create({
      data: {
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
      },
    });
  }
}
