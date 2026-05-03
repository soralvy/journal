import { Inject, Injectable } from '@nestjs/common';
import { AiBudgetCheckResult } from '@repo/database';

import { PrismaService } from '../prisma/prisma.service';
import { type AiBudgetDecision, AiBudgetService } from './ai-budget.service';
import { type AiChatCompletedResult, completeAiChatLifecyclePersistence } from './ai-chat-completion-persistence';
import { failAiChatLifecyclePersistence } from './ai-chat-failure-persistence';
import { createInitialAiChatPersistenceAnchor } from './ai-chat-initial-persistence';
import {
  AiChatFailedResult,
  AiChatFailureType,
  AiChatInitializedResult,
  ResolvedAiChatLifecycleInput,
  RunAiChatLifecycleInput,
} from './ai-chat-lifecycle.types';
import { resolveAiChatLifecycleInput } from './ai-chat-lifecycle-input';
import { findRecentAiChatMessages } from './ai-chat-recent-messages';
import { getAiChatRefusalReason, mapAiChatRefusalStatus } from './ai-chat-refusal';
import { AiJournalContextService } from './ai-journal-context.service';
import { getMvpAiModelPolicy } from './ai-model-policy';
import { assembleJournalChatPrompt, AssembleJournalChatPromptInput } from './ai-prompt-assembler';
import { AI_PROVIDER, type AiProviderPort } from './ai-provider.port';
import { AiUsageLedgerService } from './ai-usage-ledger.service';

export interface AiChatRefusedResult {
  status: 'REFUSED';
  userId: string;
  budgetCheckResult: AiBudgetCheckResult;
  refusalReason: string;
  lifecycleStartedAt: Date;
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

    try {
      return await this.completeSuccessfulLifecycle(resolvedInput, initialized);
    } catch (error) {
      return this.failHandledLifecycle(resolvedInput, initialized, error);
    }
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
      provider: 'FAKE',
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
    const modelPolicy = getMvpAiModelPolicy();
    const selectedJournalContext = await this.selectJournalContext(input);
    const recentMessages = await this.findRecentMessages(input, initialized);
    const messages = this.assembleProviderMessages(input, selectedJournalContext.items, recentMessages);
    const providerResult = await this.generateProviderResponse(messages, modelPolicy);

    return completeAiChatLifecyclePersistence(this.prisma, this.usageLedger, {
      initialized,
      lifecycleInput: input,
      providerResult,
      selectedJournalContext: selectedJournalContext.items,
      completedAt: new Date(),
    });
  }

  private async selectJournalContext(input: ResolvedAiChatLifecycleInput) {
    try {
      return await this.journalContextService.selectJournalContext({
        userId: input.userId,
        message: input.message,
        now: input.lifecycleStartedAt,
      });
    } catch (error) {
      throw new AiChatPostInitialFailureError('RETRIEVAL_ERROR', 'AI chat failed before generating a response.', error);
    }
  }

  private async findRecentMessages(input: ResolvedAiChatLifecycleInput, initialized: AiChatInitializedResult) {
    try {
      return await findRecentAiChatMessages(this.prisma, {
        userId: input.userId,
        threadId: initialized.threadId,
        beforeSequence: initialized.userMessageSequence,
      });
    } catch (error) {
      throw new AiChatPostInitialFailureError(
        'RECENT_MESSAGES_ERROR',
        'AI chat failed before generating a response.',
        error,
      );
    }
  }

  private assembleProviderMessages(
    input: ResolvedAiChatLifecycleInput,
    selectedJournalContext: AssembleJournalChatPromptInput['selectedJournalContext'],
    recentMessages: AssembleJournalChatPromptInput['recentMessages'],
  ) {
    try {
      return assembleJournalChatPrompt({
        selectedJournalContext,
        recentMessages,
        currentUserMessage: input.message,
      });
    } catch (error) {
      throw new AiChatPostInitialFailureError(
        'PROMPT_ASSEMBLY_ERROR',
        'AI chat failed before generating a response.',
        error,
      );
    }
  }

  private async generateProviderResponse(
    messages: Parameters<AiProviderPort['generate']>[0]['messages'],
    modelPolicy: ReturnType<typeof getMvpAiModelPolicy>,
  ) {
    try {
      return await this.provider.generate({
        messages,
        model: modelPolicy.model,
        maxOutputTokens: modelPolicy.maxOutputTokens,
      });
    } catch (error) {
      throw new AiChatPostInitialFailureError('PROVIDER_ERROR', 'AI provider failed to generate a response.', error);
    }
  }

  private async failHandledLifecycle(
    input: ResolvedAiChatLifecycleInput,
    initialized: AiChatInitializedResult,
    error: unknown,
  ): Promise<AiChatFailedResult> {
    if (!(error instanceof AiChatPostInitialFailureError)) {
      throw error;
    }

    return failAiChatLifecyclePersistence(this.prisma, this.usageLedger, {
      initialized,
      lifecycleInput: input,
      failureAt: new Date(),
      errorType: error.errorType,
      safeErrorMessage: error.safeErrorMessage,
      requestedModel: getMvpAiModelPolicy().model,
      provider: 'FAKE',
    });
  }
}

class AiChatPostInitialFailureError extends Error {
  constructor(
    public readonly errorType: AiChatFailureType,
    public readonly safeErrorMessage: string,
    cause: unknown,
  ) {
    super(safeErrorMessage, { cause });
    this.name = 'AiChatPostInitialFailureError';
  }
}
