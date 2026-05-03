import { Inject, Injectable } from '@nestjs/common';
import { AiBudgetCheckResult } from '@repo/database';

import { PrismaService } from '../prisma/prisma.service';
import { type AiBudgetDecision, AiBudgetService } from './ai-budget.service';
import { type AiChatCompletedResult, completeAiChatLifecyclePersistence } from './ai-chat-completion-persistence';
import { type AiChatInitializedResult, createInitialAiChatPersistenceAnchor } from './ai-chat-initial-persistence';
import {
  resolveAiChatLifecycleInput,
  type ResolvedAiChatLifecycleInput,
  type RunAiChatLifecycleInput,
} from './ai-chat-lifecycle-input';
import { findRecentAiChatMessages } from './ai-chat-recent-messages';
import { getAiChatRefusalReason, mapAiChatRefusalStatus } from './ai-chat-refusal';
import { AiJournalContextService } from './ai-journal-context.service';
import { getMvpAiModelPolicy } from './ai-model-policy';
import { assembleJournalChatPrompt } from './ai-prompt-assembler';
import { AI_PROVIDER, type AiProviderPort } from './ai-provider.port';
import { AiUsageLedgerService } from './ai-usage-ledger.service';

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
    private readonly journalContextService: AiJournalContextService,
    @Inject(AI_PROVIDER) private readonly provider: AiProviderPort,
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

    const initialized = await createInitialAiChatPersistenceAnchor(this.prisma, resolvedInput);

    return this.completeSuccessfulLifecycle(resolvedInput, initialized);
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

  private async completeSuccessfulLifecycle(
    input: ResolvedAiChatLifecycleInput,
    initialized: AiChatInitializedResult,
  ): Promise<AiChatCompletedResult> {
    const selectedJournalContext = await this.journalContextService.selectJournalContext({
      userId: input.userId,
      message: input.message,
      now: input.lifecycleStartedAt,
    });
    const recentMessages = await findRecentAiChatMessages(this.prisma, {
      userId: input.userId,
      threadId: initialized.threadId,
      beforeSequence: initialized.userMessageSequence,
    });
    const messages = assembleJournalChatPrompt({
      selectedJournalContext: selectedJournalContext.items,
      recentMessages,
      currentUserMessage: input.message,
    });
    const modelPolicy = getMvpAiModelPolicy();
    const providerResult = await this.provider.generate({
      messages,
      model: modelPolicy.model,
      maxOutputTokens: modelPolicy.maxOutputTokens,
    });

    return completeAiChatLifecyclePersistence(this.prisma, this.usageLedger, {
      initialized,
      lifecycleInput: input,
      providerResult,
      selectedJournalContext: selectedJournalContext.items,
      completedAt: new Date(),
    });
  }
}
