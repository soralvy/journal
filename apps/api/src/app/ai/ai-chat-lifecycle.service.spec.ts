import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AiBudgetCheckResult, AiEnvironment, AiUsageLogStatus } from '@repo/database';

import { type AiBudgetDecision, AiBudgetService, type CheckAiBudgetInput } from './ai-budget.service';
import {
  AiChatLifecycleNotImplementedError,
  AiChatLifecycleService,
  DEMO_USER_ID,
  InvalidAiChatBudgetDecisionError,
  InvalidAiChatInputError,
} from './ai-chat-lifecycle.service';
import { AiUsageLedgerService, type WriteAiUsageLogInput } from './ai-usage-ledger.service';

const checkBudgetMock = jest.fn<(input: CheckAiBudgetInput) => Promise<AiBudgetDecision>>();
const writeUsageLogMock = jest.fn<(input: WriteAiUsageLogInput) => Promise<Record<string, unknown>>>();

const allowedDecision: AiBudgetDecision = {
  allowed: true,
  budgetCheckResult: AiBudgetCheckResult.ALLOWED,
};

const createRefusedDecision = (
  budgetCheckResult: AiBudgetCheckResult,
  safeRefusalReason = 'safe refusal reason',
): AiBudgetDecision => ({
  allowed: false,
  budgetCheckResult,
  safeRefusalReason,
});

const getBudgetInput = (): CheckAiBudgetInput => {
  expect(checkBudgetMock).toHaveBeenCalledTimes(1);
  const firstCall = checkBudgetMock.mock.calls[0];

  if (firstCall === undefined) {
    throw new Error('Expected checkBudget to be called.');
  }

  return firstCall[0];
};

const getUsageLogInput = (): WriteAiUsageLogInput => {
  expect(writeUsageLogMock).toHaveBeenCalledTimes(1);
  const firstCall = writeUsageLogMock.mock.calls[0];

  if (firstCall === undefined) {
    throw new Error('Expected writeUsageLog to be called.');
  }

  return firstCall[0];
};

describe('AiChatLifecycleService', () => {
  let service: AiChatLifecycleService;

  beforeEach(() => {
    checkBudgetMock.mockReset();
    writeUsageLogMock.mockReset();

    checkBudgetMock.mockResolvedValue(allowedDecision);
    writeUsageLogMock.mockResolvedValue({ id: 'usage-log-id' });

    service = new AiChatLifecycleService(
      { checkBudget: checkBudgetMock } as unknown as AiBudgetService,
      { writeUsageLog: writeUsageLogMock } as unknown as AiUsageLedgerService,
    );
  });

  it('accepts surrounding whitespace in messages before calling budget and does not mutate input', async () => {
    const input = {
      message: '  hello  ',
      environment: AiEnvironment.DEMO,
      providerCallsEnabled: true,
      userId: 'user-id',
    };

    await expect(service.submitMessage(input)).rejects.toBeInstanceOf(AiChatLifecycleNotImplementedError);

    expect(input.message).toBe('  hello  ');
    expect(checkBudgetMock).toHaveBeenCalledTimes(1);
  });

  it('rejects blank messages before budget is checked', async () => {
    await expect(
      service.submitMessage({
        message: '   ',
        environment: AiEnvironment.DEMO,
        providerCallsEnabled: true,
        userId: 'user-id',
      }),
    ).rejects.toBeInstanceOf(InvalidAiChatInputError);

    expect(checkBudgetMock).not.toHaveBeenCalled();
  });

  it('rejects messages over 4000 characters', async () => {
    await expect(
      service.submitMessage({
        message: 'a'.repeat(4001),
        environment: AiEnvironment.DEMO,
        providerCallsEnabled: true,
        userId: 'user-id',
      }),
    ).rejects.toBeInstanceOf(InvalidAiChatInputError);

    expect(checkBudgetMock).not.toHaveBeenCalled();
  });

  it('rejects invalid now values', async () => {
    await expect(
      service.submitMessage({
        message: 'hello',
        environment: AiEnvironment.DEMO,
        providerCallsEnabled: true,
        now: new Date('not-a-date'),
        userId: 'user-id',
      }),
    ).rejects.toBeInstanceOf(InvalidAiChatInputError);

    expect(checkBudgetMock).not.toHaveBeenCalled();
  });

  it('resolves an explicit trimmed userId', async () => {
    await expect(
      service.submitMessage({
        message: 'hello',
        environment: AiEnvironment.DEMO,
        providerCallsEnabled: true,
        userId: '  user-id  ',
      }),
    ).rejects.toBeInstanceOf(AiChatLifecycleNotImplementedError);

    expect(getBudgetInput().userId).toBe('user-id');
  });

  it('resolves demo-user only when useDemoUser is true', async () => {
    await expect(
      service.submitMessage({
        message: 'hello',
        environment: AiEnvironment.DEMO,
        providerCallsEnabled: true,
        useDemoUser: true,
      }),
    ).rejects.toBeInstanceOf(AiChatLifecycleNotImplementedError);

    expect(getBudgetInput().userId).toBe(DEMO_USER_ID);
  });

  it('rejects missing userId when demo-user mode is not enabled', async () => {
    await expect(
      service.submitMessage({
        message: 'hello',
        environment: AiEnvironment.DEMO,
        providerCallsEnabled: true,
      }),
    ).rejects.toBeInstanceOf(InvalidAiChatInputError);

    expect(checkBudgetMock).not.toHaveBeenCalled();
  });

  it('rejects whitespace userId instead of falling back to demo-user mode', async () => {
    await expect(
      service.submitMessage({
        message: 'hello',
        environment: AiEnvironment.DEMO,
        providerCallsEnabled: true,
        userId: '   ',
        useDemoUser: true,
      }),
    ).rejects.toBeInstanceOf(InvalidAiChatInputError);

    expect(checkBudgetMock).not.toHaveBeenCalled();
  });

  it('calls budget with resolved userId, environment, live call flag, and one lifecycle start time', async () => {
    const now = new Date('2026-05-02T12:00:00.000Z');
    checkBudgetMock.mockResolvedValue(createRefusedDecision(AiBudgetCheckResult.LIVE_CALLS_DISABLED));

    await service.submitMessage({
      message: 'hello',
      environment: AiEnvironment.TEST,
      providerCallsEnabled: false,
      now,
      userId: ' user-id ',
    });

    expect(getBudgetInput()).toEqual({
      userId: 'user-id',
      environment: AiEnvironment.TEST,
      liveCallsEnabled: false,
      now,
    });
  });

  it('returns REFUSED and writes usage when budget is refused', async () => {
    const now = new Date('2026-05-02T12:00:00.000Z');
    checkBudgetMock.mockResolvedValue(
      createRefusedDecision(AiBudgetCheckResult.APP_BUDGET_EXCEEDED, 'budget exhausted'),
    );

    const result = await service.submitMessage({
      message: 'hello',
      environment: AiEnvironment.DEMO,
      providerCallsEnabled: true,
      now,
      userId: 'user-id',
    });

    expect(result).toEqual({
      status: 'REFUSED',
      userId: 'user-id',
      budgetCheckResult: AiBudgetCheckResult.APP_BUDGET_EXCEEDED,
      refusalReason: 'budget exhausted',
      lifecycleStartedAt: now,
    });
    expect(getUsageLogInput()).toEqual({
      userId: 'user-id',
      environment: AiEnvironment.DEMO,
      status: AiUsageLogStatus.BUDGET_REFUSED,
      budgetCheckResult: AiBudgetCheckResult.APP_BUDGET_EXCEEDED,
      refusalReason: 'budget exhausted',
    });
  });

  it.each([
    [AiBudgetCheckResult.LIVE_CALLS_DISABLED, AiUsageLogStatus.BUDGET_REFUSED],
    [AiBudgetCheckResult.APP_BUDGET_EXCEEDED, AiUsageLogStatus.BUDGET_REFUSED],
    [AiBudgetCheckResult.USER_DAILY_LIMIT_EXCEEDED, AiUsageLogStatus.RATE_LIMIT_REFUSED],
    [AiBudgetCheckResult.ACTIVE_STREAM_LIMIT_EXCEEDED, AiUsageLogStatus.RATE_LIMIT_REFUSED],
  ])('maps %s refusals to %s usage logs', async (budgetCheckResult, status) => {
    checkBudgetMock.mockResolvedValue(createRefusedDecision(budgetCheckResult));

    const result = await service.submitMessage({
      message: 'hello',
      environment: AiEnvironment.DEMO,
      providerCallsEnabled: budgetCheckResult !== AiBudgetCheckResult.LIVE_CALLS_DISABLED,
      userId: 'user-id',
    });

    expect(result.status).toBe('REFUSED');
    expect(getUsageLogInput()).toEqual({
      userId: 'user-id',
      environment: AiEnvironment.DEMO,
      status,
      budgetCheckResult,
      refusalReason: 'safe refusal reason',
    });
  });

  it('uses a generic safe refusal reason when the budget decision has none', async () => {
    checkBudgetMock.mockResolvedValue({
      allowed: false,
      budgetCheckResult: AiBudgetCheckResult.USER_DAILY_LIMIT_EXCEEDED,
    });

    await service.submitMessage({
      message: 'hello',
      environment: AiEnvironment.DEMO,
      providerCallsEnabled: true,
      userId: 'user-id',
    });

    expect(getUsageLogInput().refusalReason).toBe('AI chat request was refused.');
  });

  it('rejects inconsistent allowed budget results in the refusal path', async () => {
    checkBudgetMock.mockResolvedValue({
      allowed: false,
      budgetCheckResult: AiBudgetCheckResult.ALLOWED,
    });

    await expect(
      service.submitMessage({
        message: 'hello',
        environment: AiEnvironment.DEMO,
        providerCallsEnabled: true,
        userId: 'user-id',
      }),
    ).rejects.toBeInstanceOf(InvalidAiChatBudgetDecisionError);

    expect(writeUsageLogMock).not.toHaveBeenCalled();
  });

  it('does not implement the allowed lifecycle path in this phase', async () => {
    await expect(
      service.submitMessage({
        message: 'hello',
        environment: AiEnvironment.DEMO,
        providerCallsEnabled: true,
        userId: 'user-id',
      }),
    ).rejects.toBeInstanceOf(AiChatLifecycleNotImplementedError);

    expect(writeUsageLogMock).not.toHaveBeenCalled();
  });
});
