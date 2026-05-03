import { AiBudgetCheckResult, AiGenerationStatus, AiUsageLogStatus } from '@repo/database';

import { AI_CHAT_PROMPT_VERSION } from './ai-chat-initial-persistence';
import {
  AiChatFailedResult,
  AiChatFailurePersistencePrismaClient,
  AiChatFailurePersistenceTransactionClient,
  FailAiChatLifecycleInput,
} from './ai-chat-lifecycle.types';
import type { AiUsageLedgerService } from './ai-usage-ledger.service';

const getLatencyMs = (startedAt: Date, failureAt: Date): number => {
  return failureAt.getTime() - startedAt.getTime();
};

export const failAiChatLifecyclePersistence = async (
  prisma: AiChatFailurePersistencePrismaClient,
  usageLedger: AiUsageLedgerService,
  input: FailAiChatLifecycleInput,
): Promise<AiChatFailedResult> => {
  return prisma.$transaction((tx) => failAiChatLifecyclePersistenceInTransaction(tx, usageLedger, input));
};

export const failAiChatLifecyclePersistenceInTransaction = async (
  tx: AiChatFailurePersistenceTransactionClient,
  usageLedger: AiUsageLedgerService,
  input: FailAiChatLifecycleInput,
): Promise<AiChatFailedResult> => {
  const latencyMs = getLatencyMs(input.initialized.lifecycleStartedAt, input.failureAt);

  await tx.aiGeneration.update({
    where: {
      id: input.initialized.generationId,
    },
    data: {
      status: AiGenerationStatus.FAILED,
      completedAt: input.failureAt,
      latencyMs,
      errorType: input.errorType,
      safeErrorMessage: input.safeErrorMessage,
    },
  });
  await usageLedger.writeUsageLogInTransaction(tx, {
    userId: input.lifecycleInput.userId,
    threadId: input.initialized.threadId,
    generationId: input.initialized.generationId,
    environment: input.lifecycleInput.environment,
    provider: input.provider,
    model: input.requestedModel,
    promptVersion: AI_CHAT_PROMPT_VERSION,
    status: AiUsageLogStatus.FAILED,
    latencyMs,
    budgetCheckResult: AiBudgetCheckResult.ALLOWED,
    refusalReason: input.safeErrorMessage,
  });

  return {
    status: 'FAILED',
    generationId: input.initialized.generationId,
    safeErrorMessage: input.safeErrorMessage,
  };
};
