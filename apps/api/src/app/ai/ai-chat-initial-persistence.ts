import {
  AiChatMessageRole,
  AiChatThreadStatus,
  AiContentRetentionStatus,
  AiGenerationStatus,
  Prisma,
} from '@repo/database';

import {
  AiChatInitializedResult,
  AiChatInitialPersistencePrismaClient,
  AiChatInitialPersistenceTransactionClient,
  CreateInitialAiChatPersistenceInput,
  ResolvedAiChatLifecycleInput,
} from './ai-chat-lifecycle.types';
import { countAiChatMessageChars } from './ai-chat-lifecycle-input';
import { mapAiProviderNameToDbProvider } from './ai-provider.port';

export const AI_CHAT_PROMPT_VERSION = 'journal-chat-v1';

const THREAD_INACTIVITY_MS = 24 * 60 * 60 * 1000;
const CHAT_CONTENT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const INITIAL_PERSISTENCE_MAX_ATTEMPTS = 2;

export class AiChatInitialPersistenceError extends Error {
  constructor() {
    super('Initial AI chat persistence retry loop exhausted unexpectedly.');
    this.name = 'AiChatInitialPersistenceError';
  }
}

interface AiChatThreadReference {
  id: string;
}

interface AiChatMessageReference {
  id: string;
  sequence: number;
}

interface AiGenerationReference {
  id: string;
}

const addMilliseconds = (date: Date, milliseconds: number): Date => {
  return new Date(date.getTime() + milliseconds);
};

const getInactivityBoundaryAt = (lifecycleStartedAt: Date): Date => {
  return addMilliseconds(lifecycleStartedAt, THREAD_INACTIVITY_MS);
};

const getContentRetentionUntil = (lifecycleStartedAt: Date): Date => {
  return addMilliseconds(lifecycleStartedAt, CHAT_CONTENT_RETENTION_MS);
};

const isSequenceConflictTarget = (target: unknown): boolean => {
  if (!Array.isArray(target)) {
    return false;
  }

  const targetNames = target.filter((item): item is string => typeof item === 'string');
  const targetNameSet = new Set(targetNames);

  return (
    targetNameSet.has('sequence') &&
    (targetNameSet.has('threadId') || targetNameSet.has('thread_id') || targetNameSet.has('thread_id_sequence'))
  );
};

export const isMessageSequenceConflictError = (error: unknown): boolean => {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002' &&
    isSequenceConflictTarget(error.meta?.target)
  );
};

export const createInitialAiChatPersistenceAnchor = async (
  prisma: AiChatInitialPersistencePrismaClient,
  input: CreateInitialAiChatPersistenceInput,
): Promise<AiChatInitializedResult> => {
  for (let attempt = 1; attempt <= INITIAL_PERSISTENCE_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await prisma.$transaction((tx) => createInitialAiChatPersistenceAnchorInTransaction(tx, input));
    } catch (error) {
      const canRetry = attempt < INITIAL_PERSISTENCE_MAX_ATTEMPTS && isMessageSequenceConflictError(error);

      if (!canRetry) {
        throw error;
      }
    }
  }

  throw new AiChatInitialPersistenceError();
};

export const createInitialAiChatPersistenceAnchorInTransaction = async (
  tx: AiChatInitialPersistenceTransactionClient,
  input: CreateInitialAiChatPersistenceInput,
): Promise<AiChatInitializedResult> => {
  const lifecycleInput = input.lifecycleInput;
  const inactivityBoundaryAt = getInactivityBoundaryAt(lifecycleInput.lifecycleStartedAt);
  const contentRetentionUntil = getContentRetentionUntil(lifecycleInput.lifecycleStartedAt);
  const thread = await findOrCreateActiveThread(tx, lifecycleInput, inactivityBoundaryAt, contentRetentionUntil);
  const userMessage = await createUserMessage(tx, lifecycleInput, thread.id, contentRetentionUntil);
  const generation = await createRunningGeneration(tx, input, thread.id, userMessage.id);

  await tx.aiChatThread.update({
    where: {
      id: thread.id,
    },
    data: {
      lastMessageAt: lifecycleInput.lifecycleStartedAt,
      inactivityBoundaryAt,
      contentRetentionUntil,
    },
  });

  return {
    status: 'INITIALIZED',
    threadId: thread.id,
    userMessageId: userMessage.id,
    generationId: generation.id,
    userMessageSequence: userMessage.sequence,
    lifecycleStartedAt: lifecycleInput.lifecycleStartedAt,
  };
};

const findOrCreateActiveThread = async (
  tx: AiChatInitialPersistenceTransactionClient,
  input: ResolvedAiChatLifecycleInput,
  inactivityBoundaryAt: Date,
  contentRetentionUntil: Date,
): Promise<AiChatThreadReference> => {
  await tx.aiChatThread.updateMany({
    where: {
      userId: input.userId,
      status: AiChatThreadStatus.ACTIVE,
      deletedAt: null,
      inactivityBoundaryAt: {
        lte: input.lifecycleStartedAt,
      },
    },
    data: {
      status: AiChatThreadStatus.INACTIVE,
    },
  });

  const activeThread = await tx.aiChatThread.findFirst({
    where: {
      userId: input.userId,
      status: AiChatThreadStatus.ACTIVE,
      deletedAt: null,
      inactivityBoundaryAt: {
        gt: input.lifecycleStartedAt,
      },
    },
    orderBy: {
      lastMessageAt: 'desc',
    },
    select: {
      id: true,
    },
  });

  if (activeThread !== null) {
    return activeThread;
  }

  return tx.aiChatThread.create({
    data: {
      userId: input.userId,
      status: AiChatThreadStatus.ACTIVE,
      title: null,
      lastMessageAt: input.lifecycleStartedAt,
      inactivityBoundaryAt,
      contentRetentionUntil,
      contentRetentionStatus: AiContentRetentionStatus.ACTIVE,
    },
    select: {
      id: true,
    },
  });
};

const createUserMessage = async (
  tx: AiChatInitialPersistenceTransactionClient,
  input: ResolvedAiChatLifecycleInput,
  threadId: string,
  contentRetentionUntil: Date,
): Promise<AiChatMessageReference> => {
  const previousMessage = await tx.aiChatMessage.findFirst({
    where: {
      threadId,
    },
    orderBy: {
      sequence: 'desc',
    },
    select: {
      sequence: true,
    },
  });
  const sequence = (previousMessage?.sequence ?? 0) + 1;

  return tx.aiChatMessage.create({
    data: {
      threadId,
      userId: input.userId,
      role: AiChatMessageRole.USER,
      content: input.message,
      contentCharCount: countAiChatMessageChars(input.message),
      sequence,
      contentRetentionUntil,
      contentRetentionStatus: AiContentRetentionStatus.ACTIVE,
    },
    select: {
      id: true,
      sequence: true,
    },
  });
};

const createRunningGeneration = async (
  tx: AiChatInitialPersistenceTransactionClient,
  input: CreateInitialAiChatPersistenceInput,
  threadId: string,
  userMessageId: string,
): Promise<AiGenerationReference> => {
  return tx.aiGeneration.create({
    data: {
      userId: input.lifecycleInput.userId,
      threadId,
      userMessageId,
      provider: mapAiProviderNameToDbProvider(input.generationPolicy.providerName),
      requestedModel: input.generationPolicy.requestedModel,
      promptVersion: input.generationPolicy.promptVersion,
      status: AiGenerationStatus.RUNNING,
      startedAt: input.lifecycleInput.lifecycleStartedAt,
      maxOutputTokens: input.generationPolicy.maxOutputTokens,
    },
    select: {
      id: true,
    },
  });
};
