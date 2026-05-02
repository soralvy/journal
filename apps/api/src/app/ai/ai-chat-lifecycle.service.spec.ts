import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AiBudgetCheckResult, AiEnvironment, AiUsageLogStatus } from '@repo/database';

import { PrismaService } from '../prisma/prisma.service';
import { type AiBudgetDecision, AiBudgetService, type CheckAiBudgetInput } from './ai-budget.service';
import { AiChatLifecycleService } from './ai-chat-lifecycle.service';
import { InvalidAiChatInputError } from './ai-chat-lifecycle-input';
import { AiUsageLedgerService, type WriteAiUsageLogInput } from './ai-usage-ledger.service';

type TransactionCallback<T> = (tx: typeof transactionClient) => Promise<T>;

const checkBudgetMock = jest.fn<(input: CheckAiBudgetInput) => Promise<AiBudgetDecision>>();
const writeUsageLogMock = jest.fn<(input: WriteAiUsageLogInput) => Promise<Record<string, unknown>>>();
const transactionMock = jest.fn(<T>(callback: TransactionCallback<T>) => callback(transactionClient));
const threadUpdateManyMock = jest.fn<() => Promise<Record<string, unknown>>>();
const threadFindFirstMock = jest.fn<() => Promise<{ id: string } | null>>();
const threadCreateMock = jest.fn<() => Promise<{ id: string }>>();
const threadUpdateMock = jest.fn<() => Promise<Record<string, unknown>>>();
const messageFindFirstMock = jest.fn<() => Promise<{ sequence: number } | null>>();
const messageCreateMock = jest.fn<() => Promise<{ id: string; sequence: number }>>();
const generationCreateMock = jest.fn<() => Promise<{ id: string }>>();

const transactionClient = {
  aiChatThread: {
    updateMany: threadUpdateManyMock,
    findFirst: threadFindFirstMock,
    create: threadCreateMock,
    update: threadUpdateMock,
  },
  aiChatMessage: {
    findFirst: messageFindFirstMock,
    create: messageCreateMock,
  },
  aiGeneration: {
    create: generationCreateMock,
  },
};

const prismaService = {
  $transaction: transactionMock,
};

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
    transactionMock.mockReset();
    threadUpdateManyMock.mockReset();
    threadFindFirstMock.mockReset();
    threadCreateMock.mockReset();
    threadUpdateMock.mockReset();
    messageFindFirstMock.mockReset();
    messageCreateMock.mockReset();
    generationCreateMock.mockReset();

    checkBudgetMock.mockResolvedValue(allowedDecision);
    writeUsageLogMock.mockResolvedValue({ id: 'usage-log-id' });
    transactionMock.mockImplementation(<T>(callback: TransactionCallback<T>) => callback(transactionClient));
    threadUpdateManyMock.mockResolvedValue({ count: 0 });
    threadFindFirstMock.mockResolvedValue(null);
    threadCreateMock.mockResolvedValue({ id: 'thread-new' });
    threadUpdateMock.mockResolvedValue({ id: 'thread-new' });
    messageFindFirstMock.mockResolvedValue(null);
    messageCreateMock.mockResolvedValue({ id: 'user-message-id', sequence: 1 });
    generationCreateMock.mockResolvedValue({ id: 'generation-id' });

    service = new AiChatLifecycleService(
      prismaService as unknown as PrismaService,
      { checkBudget: checkBudgetMock } as unknown as AiBudgetService,
      { writeUsageLog: writeUsageLogMock } as unknown as AiUsageLedgerService,
    );
  });

  it('resolves input before checking budget', async () => {
    const now = new Date('2026-05-02T12:00:00.000Z');

    await service.submitMessage({
      message: '  hello  ',
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

  it('rejects invalid input before budget is checked', async () => {
    await expect(
      service.submitMessage({
        message: '   ',
        environment: AiEnvironment.DEMO,
        providerCallsEnabled: true,
        userId: 'user-id',
      }),
    ).rejects.toBeInstanceOf(InvalidAiChatInputError);

    expect(checkBudgetMock).not.toHaveBeenCalled();
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it('writes refusal usage and skips initial persistence when budget is refused', async () => {
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
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it('creates the initial persistence anchor when budget allows', async () => {
    const now = new Date('2026-05-02T12:00:00.000Z');

    const result = await service.submitMessage({
      message: 'hello',
      environment: AiEnvironment.DEMO,
      providerCallsEnabled: true,
      now,
      userId: 'user-id',
    });

    expect(result).toEqual({
      status: 'INITIALIZED',
      threadId: 'thread-new',
      userMessageId: 'user-message-id',
      generationId: 'generation-id',
      userMessageSequence: 1,
      lifecycleStartedAt: now,
    });
    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(writeUsageLogMock).not.toHaveBeenCalled();
  });
});
