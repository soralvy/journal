import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  AiChatMessageRole,
  AiChatThreadStatus,
  AiContentRetentionStatus,
  AiEnvironment,
  AiGenerationStatus,
  AiProvider,
  Prisma,
} from '@repo/database';

import { AI_CHAT_PROMPT_VERSION, createInitialAiChatPersistenceAnchor } from './ai-chat-initial-persistence';
import type {
  AiChatInitialPersistenceTransactionClient,
  CreateInitialAiChatPersistenceInput,
  ResolvedAiChatLifecycleInput,
} from './ai-chat-lifecycle.types';
import { AI_DEFAULT_MODEL, AI_MAX_OUTPUT_TOKENS } from './ai-model-policy';

type TransactionCallback<T> = (tx: typeof transactionClient) => Promise<T>;

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
} satisfies AiChatInitialPersistenceTransactionClient;

const prismaClient = {
  $transaction: transactionMock,
};

const createResolvedInput = (overrides: Partial<ResolvedAiChatLifecycleInput> = {}): ResolvedAiChatLifecycleInput => ({
  message: 'hello',
  userId: 'user-id',
  environment: AiEnvironment.DEMO,
  providerCallsEnabled: true,
  lifecycleStartedAt: new Date('2026-05-02T12:00:00.000Z'),
  ...overrides,
});

const createInitialPersistenceInput = (
  lifecycleOverrides: Partial<ResolvedAiChatLifecycleInput> = {},
): CreateInitialAiChatPersistenceInput => ({
  lifecycleInput: createResolvedInput(lifecycleOverrides),
  generationPolicy: {
    provider: AiProvider.FAKE,
    providerName: 'FAKE',
    requestedModel: AI_DEFAULT_MODEL,
    maxOutputTokens: AI_MAX_OUTPUT_TOKENS,
    promptVersion: AI_CHAT_PROMPT_VERSION,
  },
});

const createSequenceConflictError = (): Prisma.PrismaClientKnownRequestError => {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed on thread message sequence.', {
    code: 'P2002',
    clientVersion: 'test',
    meta: {
      target: ['thread_id', 'sequence'],
    },
  });
};

const getTransactionCallback = (): TransactionCallback<unknown> => {
  expect(transactionMock).toHaveBeenCalledTimes(1);
  const firstCall = transactionMock.mock.calls[0];

  if (firstCall === undefined) {
    throw new Error('Expected transaction to be called.');
  }

  return firstCall[0];
};

describe('createInitialAiChatPersistenceAnchor', () => {
  beforeEach(() => {
    transactionMock.mockReset();
    threadUpdateManyMock.mockReset();
    threadFindFirstMock.mockReset();
    threadCreateMock.mockReset();
    threadUpdateMock.mockReset();
    messageFindFirstMock.mockReset();
    messageCreateMock.mockReset();
    generationCreateMock.mockReset();

    transactionMock.mockImplementation(<T>(callback: TransactionCallback<T>) => callback(transactionClient));
    threadUpdateManyMock.mockResolvedValue({ count: 0 });
    threadFindFirstMock.mockResolvedValue(null);
    threadCreateMock.mockResolvedValue({ id: 'thread-new' });
    threadUpdateMock.mockResolvedValue({ id: 'thread-new' });
    messageFindFirstMock.mockResolvedValue(null);
    messageCreateMock.mockResolvedValue({ id: 'user-message-id', sequence: 1 });
    generationCreateMock.mockResolvedValue({ id: 'generation-id' });
  });

  it('creates a new thread when none is active', async () => {
    const input = createInitialPersistenceInput();

    const result = await createInitialAiChatPersistenceAnchor(prismaClient, input);

    expect(result).toEqual({
      status: 'INITIALIZED',
      threadId: 'thread-new',
      userMessageId: 'user-message-id',
      generationId: 'generation-id',
      userMessageSequence: 1,
      lifecycleStartedAt: input.lifecycleInput.lifecycleStartedAt,
    });
    expect(threadCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-id',
        status: AiChatThreadStatus.ACTIVE,
        title: null,
        lastMessageAt: input.lifecycleInput.lifecycleStartedAt,
        contentRetentionStatus: AiContentRetentionStatus.ACTIVE,
      }),
      select: {
        id: true,
      },
    });
  });

  it('reuses an active unexpired thread', async () => {
    threadFindFirstMock.mockResolvedValue({ id: 'thread-active' });

    const result = await createInitialAiChatPersistenceAnchor(prismaClient, createInitialPersistenceInput());

    expect(result.status).toBe('INITIALIZED');
    expect(result.threadId).toBe('thread-active');
    expect(threadCreateMock).not.toHaveBeenCalled();
    expect(messageCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          threadId: 'thread-active',
        }),
      }),
    );
  });

  it('marks expired active threads inactive before selecting the active thread', async () => {
    const input = createInitialPersistenceInput();

    await createInitialAiChatPersistenceAnchor(prismaClient, input);

    expect(threadUpdateManyMock).toHaveBeenCalledWith({
      where: {
        userId: 'user-id',
        status: AiChatThreadStatus.ACTIVE,
        deletedAt: null,
        inactivityBoundaryAt: {
          lte: input.lifecycleInput.lifecycleStartedAt,
        },
      },
      data: {
        status: AiChatThreadStatus.INACTIVE,
      },
    });
  });

  it('creates user message and RUNNING generation in the initial transaction', async () => {
    await createInitialAiChatPersistenceAnchor(prismaClient, createInitialPersistenceInput());

    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(getTransactionCallback()).toEqual(expect.any(Function));
    expect(messageCreateMock).toHaveBeenCalledTimes(1);
    expect(generationCreateMock).toHaveBeenCalledTimes(1);
    expect(generationCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: AiGenerationStatus.RUNNING,
      }),
      select: {
        id: true,
      },
    });
  });

  it('uses lifecycleStartedAt for thread timestamps, retention, message retention, and generation start', async () => {
    const input = createInitialPersistenceInput();
    const inactivityBoundaryAt = new Date('2026-05-03T12:00:00.000Z');
    const contentRetentionUntil = new Date('2026-06-01T12:00:00.000Z');

    await createInitialAiChatPersistenceAnchor(prismaClient, input);

    expect(threadCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        lastMessageAt: input.lifecycleInput.lifecycleStartedAt,
        inactivityBoundaryAt,
        contentRetentionUntil,
      }),
      select: {
        id: true,
      },
    });
    expect(messageCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        contentRetentionUntil,
      }),
      select: {
        id: true,
        sequence: true,
      },
    });
    expect(generationCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        startedAt: input.lifecycleInput.lifecycleStartedAt,
      }),
      select: {
        id: true,
      },
    });
    expect(threadUpdateMock).toHaveBeenCalledWith({
      where: {
        id: 'thread-new',
      },
      data: {
        lastMessageAt: input.lifecycleInput.lifecycleStartedAt,
        inactivityBoundaryAt,
        contentRetentionUntil,
      },
    });
  });

  it('persists the trimmed user message content provided by input resolution', async () => {
    await createInitialAiChatPersistenceAnchor(
      prismaClient,
      createInitialPersistenceInput({ message: 'trimmed message' }),
    );

    expect(messageCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        content: 'trimmed message',
        contentCharCount: 'trimmed message'.length,
        role: AiChatMessageRole.USER,
      }),
      select: {
        id: true,
        sequence: true,
      },
    });
  });

  it('allocates sequence as max existing sequence plus one', async () => {
    messageFindFirstMock.mockResolvedValue({ sequence: 4 });
    messageCreateMock.mockResolvedValue({ id: 'user-message-id', sequence: 5 });

    const result = await createInitialAiChatPersistenceAnchor(prismaClient, createInitialPersistenceInput());

    expect(result.status).toBe('INITIALIZED');
    expect(result.userMessageSequence).toBe(5);
    expect(messageCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sequence: 5,
      }),
      select: {
        id: true,
        sequence: true,
      },
    });
  });

  it('creates the RUNNING generation with fake provider and MVP model policy', async () => {
    await createInitialAiChatPersistenceAnchor(prismaClient, createInitialPersistenceInput());

    expect(generationCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-id',
        threadId: 'thread-new',
        userMessageId: 'user-message-id',
        provider: AiProvider.FAKE,
        requestedModel: AI_DEFAULT_MODEL,
        promptVersion: AI_CHAT_PROMPT_VERSION,
        status: AiGenerationStatus.RUNNING,
        maxOutputTokens: AI_MAX_OUTPUT_TOKENS,
      }),
      select: {
        id: true,
      },
    });
  });

  it('retries a P2002 message sequence conflict once', async () => {
    messageCreateMock.mockRejectedValueOnce(createSequenceConflictError());

    const result = await createInitialAiChatPersistenceAnchor(prismaClient, createInitialPersistenceInput());

    expect(result.status).toBe('INITIALIZED');
    expect(transactionMock).toHaveBeenCalledTimes(2);
    expect(messageCreateMock).toHaveBeenCalledTimes(2);
  });

  it('stops after two P2002 message sequence conflict attempts', async () => {
    messageCreateMock.mockRejectedValue(createSequenceConflictError());

    await expect(
      createInitialAiChatPersistenceAnchor(prismaClient, createInitialPersistenceInput()),
    ).rejects.toMatchObject({
      code: 'P2002',
    });

    expect(transactionMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry arbitrary persistence errors', async () => {
    const persistenceError = new Error('database unavailable');
    messageCreateMock.mockRejectedValue(persistenceError);

    await expect(createInitialAiChatPersistenceAnchor(prismaClient, createInitialPersistenceInput())).rejects.toBe(
      persistenceError,
    );

    expect(transactionMock).toHaveBeenCalledTimes(1);
  });
});
