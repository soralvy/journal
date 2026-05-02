import { Injectable } from '@nestjs/common';
import { AiBudgetCheckResult } from '@repo/database';

import { PrismaService } from '../prisma/prisma.service';
import { type AiBudgetDecision, AiBudgetService } from './ai-budget.service';
import { type AiChatInitializedResult, createInitialAiChatPersistenceAnchor } from './ai-chat-initial-persistence';
import {
  resolveAiChatLifecycleInput,
  type ResolvedAiChatLifecycleInput,
  type RunAiChatLifecycleInput,
} from './ai-chat-lifecycle-input';
import { getAiChatRefusalReason, mapAiChatRefusalStatus } from './ai-chat-refusal';
import { AiUsageLedgerService } from './ai-usage-ledger.service';

export interface AiChatCompletedResult {
  status: 'COMPLETED';
  threadId: string;
  userMessageId: string;
  assistantMessageId: string;
  generationId: string;
  assistantMessageContent: string;
}

export interface AiChatRefusedResult {
  status: 'REFUSED';
  userId: string;
  budgetCheckResult: AiBudgetCheckResult;
  refusalReason: string;
  lifecycleStartedAt: Date;
}

export interface AiChatFailedResult {
  status: 'FAILED';
  safeErrorMessage: string;
  generationId?: string;
}

export type AiChatLifecycleResult =
  | AiChatCompletedResult
  | AiChatInitializedResult
  | AiChatRefusedResult
  | AiChatFailedResult;

export class AiChatLifecycleNotImplementedError extends Error {
  constructor() {
    super('Allowed AI chat lifecycle is not implemented in this phase.');
    this.name = 'AiChatLifecycleNotImplementedError';
  }
}

@Injectable()
export class AiChatLifecycleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly budgetService: AiBudgetService,
    private readonly usageLedger: AiUsageLedgerService,
  ) {}

  async submitMessage(input: RunAiChatLifecycleInput): Promise<AiChatLifecycleResult> {
    const resolvedInput = resolveAiChatLifecycleInput(input);
    const budgetDecision = await this.budgetService.checkBudget({
      userId: resolvedInput.userId,
      environment: resolvedInput.environment,
      liveCallsEnabled: resolvedInput.providerCallsEnabled,
      now: resolvedInput.lifecycleStartedAt,
    });

    if (!budgetDecision.allowed) {
      return this.refuseRequest(resolvedInput, budgetDecision);
    }

    return createInitialAiChatPersistenceAnchor(this.prisma, resolvedInput);
  }

  private async refuseRequest(
    input: ResolvedAiChatLifecycleInput,
    budgetDecision: AiBudgetDecision,
  ): Promise<AiChatRefusedResult> {
    const refusalReason = getAiChatRefusalReason(budgetDecision);

    await this.usageLedger.writeUsageLog({
      userId: input.userId,
      environment: input.environment,
      status: mapAiChatRefusalStatus(budgetDecision.budgetCheckResult),
      budgetCheckResult: budgetDecision.budgetCheckResult,
      refusalReason,
    });

    return {
      status: 'REFUSED',
      userId: input.userId,
      budgetCheckResult: budgetDecision.budgetCheckResult,
      refusalReason,
      lifecycleStartedAt: input.lifecycleStartedAt,
    };
  }
}
