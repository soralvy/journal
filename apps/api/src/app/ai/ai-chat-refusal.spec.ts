import { describe, expect, it } from '@jest/globals';
import { AiBudgetCheckResult, AiUsageLogStatus } from '@repo/database';

import type { AiBudgetDecision } from './ai-budget.service';
import { getAiChatRefusalReason, InvalidAiChatBudgetDecisionError, mapAiChatRefusalStatus } from './ai-chat-refusal';

describe('mapAiChatRefusalStatus', () => {
  it.each([
    [AiBudgetCheckResult.LIVE_CALLS_DISABLED, AiUsageLogStatus.BUDGET_REFUSED],
    [AiBudgetCheckResult.APP_BUDGET_EXCEEDED, AiUsageLogStatus.BUDGET_REFUSED],
    [AiBudgetCheckResult.USER_DAILY_LIMIT_EXCEEDED, AiUsageLogStatus.RATE_LIMIT_REFUSED],
    [AiBudgetCheckResult.ACTIVE_STREAM_LIMIT_EXCEEDED, AiUsageLogStatus.RATE_LIMIT_REFUSED],
  ])('maps %s to %s', (budgetCheckResult, status) => {
    expect(mapAiChatRefusalStatus(budgetCheckResult)).toBe(status);
  });

  it('rejects ALLOWED because it is not a refusal result', () => {
    expect(() => mapAiChatRefusalStatus(AiBudgetCheckResult.ALLOWED)).toThrow(InvalidAiChatBudgetDecisionError);
  });
});

describe('getAiChatRefusalReason', () => {
  it('uses the safe refusal reason from the budget decision', () => {
    const decision: AiBudgetDecision = {
      allowed: false,
      budgetCheckResult: AiBudgetCheckResult.APP_BUDGET_EXCEEDED,
      safeRefusalReason: 'budget exhausted',
    };

    expect(getAiChatRefusalReason(decision)).toBe('budget exhausted');
  });

  it('uses a generic safe reason when the budget decision has none', () => {
    const decision: AiBudgetDecision = {
      allowed: false,
      budgetCheckResult: AiBudgetCheckResult.USER_DAILY_LIMIT_EXCEEDED,
    };

    expect(getAiChatRefusalReason(decision)).toBe('AI chat request was refused.');
  });
});
