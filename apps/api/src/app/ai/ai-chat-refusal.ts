import { AiBudgetCheckResult, AiUsageLogStatus } from '@repo/database';

import type { AiBudgetDecision } from './ai-budget.service';

const GENERIC_REFUSAL_REASON = 'AI chat request was refused.';

export class InvalidAiChatBudgetDecisionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidAiChatBudgetDecisionError';
  }
}

export const mapAiChatRefusalStatus = (budgetCheckResult: AiBudgetCheckResult): AiUsageLogStatus => {
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

export const getAiChatRefusalReason = (decision: AiBudgetDecision): string => {
  return decision.safeRefusalReason ?? GENERIC_REFUSAL_REASON;
};
