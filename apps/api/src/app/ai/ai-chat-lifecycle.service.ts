import { Injectable } from '@nestjs/common';
import type { AiEnvironment } from '@repo/database';
import { AiBudgetCheckResult, AiUsageLogStatus } from '@repo/database';

import { type AiBudgetDecision, AiBudgetService } from './ai-budget.service';
import { AiUsageLedgerService } from './ai-usage-ledger.service';

export const MAX_CHAT_MESSAGE_CHARS = 4000;
export const DEMO_USER_ID = 'demo-user';
export const AI_CHAT_PROMPT_VERSION = 'journal-chat-v1';

const GENERIC_REFUSAL_REASON = 'AI chat request was refused.';

export interface RunAiChatLifecycleInput {
  message: string;
  environment: AiEnvironment;
  providerCallsEnabled: boolean;
  now?: Date;
  userId?: string;
  useDemoUser?: boolean;
}

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

export type AiChatLifecycleResult = AiChatCompletedResult | AiChatRefusedResult | AiChatFailedResult;

export class InvalidAiChatInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidAiChatInputError';
  }
}

export class AiChatLifecycleNotImplementedError extends Error {
  constructor() {
    super('Allowed AI chat lifecycle is not implemented in this phase.');
    this.name = 'AiChatLifecycleNotImplementedError';
  }
}

export class InvalidAiChatBudgetDecisionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidAiChatBudgetDecisionError';
  }
}

interface ResolvedAiChatLifecycleInput {
  message: string;
  userId: string;
  lifecycleStartedAt: Date;
}

const isValidDate = (date: Date): boolean => {
  return Number.isFinite(date.getTime());
};

const trimInputString = (value: unknown, fieldName: string): string => {
  if (typeof value !== 'string') {
    throw new InvalidAiChatInputError(`${fieldName} must be a string.`);
  }

  return value.trim();
};

const resolveLifecycleStartedAt = (now: Date | undefined): Date => {
  if (now === undefined) {
    return new Date();
  }

  if (!isValidDate(now)) {
    throw new InvalidAiChatInputError('now must be a valid Date.');
  }

  return now;
};

const resolveMessage = (message: string): string => {
  const trimmedMessage = trimInputString(message, 'message');

  if (trimmedMessage === '') {
    throw new InvalidAiChatInputError('message must be non-empty.');
  }

  if ([...trimmedMessage].length > MAX_CHAT_MESSAGE_CHARS) {
    throw new InvalidAiChatInputError(`message must be at most ${MAX_CHAT_MESSAGE_CHARS} characters.`);
  }

  return trimmedMessage;
};

const resolveUserId = (input: RunAiChatLifecycleInput): string => {
  if (input.userId !== undefined) {
    const trimmedUserId = trimInputString(input.userId, 'userId');

    if (trimmedUserId === '') {
      throw new InvalidAiChatInputError('userId must be non-empty.');
    }

    return trimmedUserId;
  }

  if (input.useDemoUser === true) {
    return DEMO_USER_ID;
  }

  throw new InvalidAiChatInputError('userId is required.');
};

const resolveInput = (input: RunAiChatLifecycleInput): ResolvedAiChatLifecycleInput => ({
  message: resolveMessage(input.message),
  userId: resolveUserId(input),
  lifecycleStartedAt: resolveLifecycleStartedAt(input.now),
});

const mapRefusalStatus = (budgetCheckResult: AiBudgetCheckResult): AiUsageLogStatus => {
  switch (budgetCheckResult) {
    case AiBudgetCheckResult.APP_BUDGET_EXCEEDED:
    case AiBudgetCheckResult.LIVE_CALLS_DISABLED: {
      return AiUsageLogStatus.BUDGET_REFUSED;
    }
    case AiBudgetCheckResult.USER_DAILY_LIMIT_EXCEEDED:
    case AiBudgetCheckResult.ACTIVE_STREAM_LIMIT_EXCEEDED: {
      return AiUsageLogStatus.RATE_LIMIT_REFUSED;
    }
    case AiBudgetCheckResult.ALLOWED: {
      throw new InvalidAiChatBudgetDecisionError('Cannot map an allowed budget decision to a refusal status.');
    }
  }
};

const getRefusalReason = (decision: AiBudgetDecision): string => {
  return decision.safeRefusalReason ?? GENERIC_REFUSAL_REASON;
};

@Injectable()
export class AiChatLifecycleService {
  constructor(
    private readonly budgetService: AiBudgetService,
    private readonly usageLedger: AiUsageLedgerService,
  ) {}

  async submitMessage(input: RunAiChatLifecycleInput): Promise<AiChatLifecycleResult> {
    const resolvedInput = resolveInput(input);
    const budgetDecision = await this.budgetService.checkBudget({
      userId: resolvedInput.userId,
      environment: input.environment,
      liveCallsEnabled: input.providerCallsEnabled,
      now: resolvedInput.lifecycleStartedAt,
    });

    if (!budgetDecision.allowed) {
      return this.refuseRequest(input, resolvedInput, budgetDecision);
    }

    throw new AiChatLifecycleNotImplementedError();
  }

  private async refuseRequest(
    input: RunAiChatLifecycleInput,
    resolvedInput: ResolvedAiChatLifecycleInput,
    budgetDecision: AiBudgetDecision,
  ): Promise<AiChatRefusedResult> {
    const refusalReason = getRefusalReason(budgetDecision);

    await this.usageLedger.writeUsageLog({
      userId: resolvedInput.userId,
      environment: input.environment,
      status: mapRefusalStatus(budgetDecision.budgetCheckResult),
      budgetCheckResult: budgetDecision.budgetCheckResult,
      refusalReason,
    });

    return {
      status: 'REFUSED',
      userId: resolvedInput.userId,
      budgetCheckResult: budgetDecision.budgetCheckResult,
      refusalReason,
      lifecycleStartedAt: resolvedInput.lifecycleStartedAt,
    };
  }
}
