import {
  AiBudgetCheckResult,
  AiChatMessageRole,
  AiContentRetentionStatus,
  AiGenerationStatus,
  AiUsageLogStatus,
  Prisma,
} from '@repo/database';

import type { AiChatInitializedResult } from './ai-chat-initial-persistence';
import { AI_CHAT_PROMPT_VERSION, isMessageSequenceConflictError } from './ai-chat-initial-persistence';
import { countAiChatMessageChars, type ResolvedAiChatLifecycleInput } from './ai-chat-lifecycle-input';
import type { AiProviderGenerateResult } from './ai-provider.port';
import type { AiUsageLedgerService } from './ai-usage-ledger.service';
import type { SelectedJournalContextItem } from './journal-context.types';

const THREAD_INACTIVITY_MS = 24 * 60 * 60 * 1000;
const CHAT_CONTENT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const COMPLETION_PERSISTENCE_MAX_ATTEMPTS = 2;

export interface CompleteAiChatLifecycleInput {
  initialized: AiChatInitializedResult;
  lifecycleInput: ResolvedAiChatLifecycleInput;
  providerResult: AiProviderGenerateResult;
  selectedJournalContext: readonly SelectedJournalContextItem[];
  completedAt: Date;
}

export interface AiChatCompletedResult {
  status: 'COMPLETED';
  threadId: string;
  userMessageId: string;
  assistantMessageId: string;
  generationId: string;
  assistantMessageContent: string;
}

export interface AiChatCompletionPersistencePrismaClient {
  $transaction<T>(callback: (tx: AiChatCompletionPersistenceTransactionClient) => Promise<T>): Promise<T>;
}

export type AiChatCompletionPersistenceTransactionClient = Pick<
  Prisma.TransactionClient,
  'aiChatMessage' | 'aiGeneration' | 'aiJournalContextUse' | 'aiUsageLog' | 'aiChatThread'
>;

interface AssistantMessageReference {
  id: string;
  sequence: number;
}

const addMilliseconds = (date: Date, milliseconds: number): Date => {
  return new Date(date.getTime() + milliseconds);
};

const getInactivityBoundaryAt = (completedAt: Date): Date => {
  return addMilliseconds(completedAt, THREAD_INACTIVITY_MS);
};

const getContentRetentionUntil = (completedAt: Date): Date => {
  return addMilliseconds(completedAt, CHAT_CONTENT_RETENTION_MS);
};

const getLatencyMs = (startedAt: Date, completedAt: Date): number => {
  return completedAt.getTime() - startedAt.getTime();
};

export const completeAiChatLifecyclePersistence = async (
  prisma: AiChatCompletionPersistencePrismaClient,
  usageLedger: AiUsageLedgerService,
  input: CompleteAiChatLifecycleInput,
): Promise<AiChatCompletedResult> => {
  for (let attempt = 1; attempt <= COMPLETION_PERSISTENCE_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await prisma.$transaction((tx) => completeAiChatLifecyclePersistenceInTransaction(tx, usageLedger, input));
    } catch (error) {
      const canRetry = attempt < COMPLETION_PERSISTENCE_MAX_ATTEMPTS && isMessageSequenceConflictError(error);

      if (!canRetry) {
        throw error;
      }
    }
  }

  throw new Error('AI chat completion persistence retry loop exhausted unexpectedly.');
};

export const completeAiChatLifecyclePersistenceInTransaction = async (
  tx: AiChatCompletionPersistenceTransactionClient,
  usageLedger: AiUsageLedgerService,
  input: CompleteAiChatLifecycleInput,
): Promise<AiChatCompletedResult> => {
  const latencyMs = getLatencyMs(input.initialized.lifecycleStartedAt, input.completedAt);
  const contentRetentionUntil = getContentRetentionUntil(input.completedAt);
  const assistantMessage = await createAssistantMessage(tx, input, contentRetentionUntil);

  await tx.aiGeneration.update({
    where: {
      id: input.initialized.generationId,
    },
    data: {
      status: AiGenerationStatus.COMPLETED,
      assistantMessageId: assistantMessage.id,
      actualModel: input.providerResult.model,
      finishReason: input.providerResult.finishReason,
      completedAt: input.completedAt,
      latencyMs,
      providerResponseId: null,
    },
  });
  await createJournalContextUseRows(tx, input);
  await usageLedger.writeUsageLogInTransaction(tx, {
    userId: input.lifecycleInput.userId,
    threadId: input.initialized.threadId,
    generationId: input.initialized.generationId,
    environment: input.lifecycleInput.environment,
    provider: input.providerResult.provider,
    model: input.providerResult.model,
    promptVersion: AI_CHAT_PROMPT_VERSION,
    status: AiUsageLogStatus.COMPLETED,
    usage: input.providerResult.usage,
    latencyMs,
    budgetCheckResult: AiBudgetCheckResult.ALLOWED,
  });
  await tx.aiChatThread.update({
    where: {
      id: input.initialized.threadId,
    },
    data: {
      lastMessageAt: input.completedAt,
      inactivityBoundaryAt: getInactivityBoundaryAt(input.completedAt),
      contentRetentionUntil,
    },
  });

  return {
    status: 'COMPLETED',
    threadId: input.initialized.threadId,
    userMessageId: input.initialized.userMessageId,
    assistantMessageId: assistantMessage.id,
    generationId: input.initialized.generationId,
    assistantMessageContent: input.providerResult.text,
  };
};

const createAssistantMessage = async (
  tx: AiChatCompletionPersistenceTransactionClient,
  input: CompleteAiChatLifecycleInput,
  contentRetentionUntil: Date,
): Promise<AssistantMessageReference> => {
  const previousMessage = await tx.aiChatMessage.findFirst({
    where: {
      threadId: input.initialized.threadId,
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
      threadId: input.initialized.threadId,
      userId: input.lifecycleInput.userId,
      role: AiChatMessageRole.ASSISTANT,
      content: input.providerResult.text,
      contentCharCount: countAiChatMessageChars(input.providerResult.text),
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

const createJournalContextUseRows = async (
  tx: AiChatCompletionPersistenceTransactionClient,
  input: CompleteAiChatLifecycleInput,
): Promise<void> => {
  if (input.selectedJournalContext.length === 0) {
    return;
  }

  await tx.aiJournalContextUse.createMany({
    data: input.selectedJournalContext.map((item) => ({
      generationId: input.initialized.generationId,
      userId: input.lifecycleInput.userId,
      journalEntryId: item.journalEntryId,
      selectionMode: item.selectionMode,
      selectionReason: item.selectionReason,
      rank: item.rank,
      includedCharCount: item.includedCharCount,
      includedTokenEstimate: item.includedTokenEstimate,
      journalEntryCreatedAt: item.journalEntryCreatedAt,
    })),
  });
};
