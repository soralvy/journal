import type { AiEnvironment, AiGeneration, Prisma } from '@repo/database';

import type { AiProviderName } from './ai-provider.port';
import { AiUsageLogTransactionClient, WriteAiUsageLogInput } from './ai-usage-ledger.service';

export const AI_CHAT_FAILURE_TYPES = {
  RETRIEVAL_ERROR: 'RETRIEVAL_ERROR',
  RECENT_MESSAGES_ERROR: 'RECENT_MESSAGES_ERROR',
  PROMPT_ASSEMBLY_ERROR: 'PROMPT_ASSEMBLY_ERROR',
  PROVIDER_ERROR: 'PROVIDER_ERROR',
} as const;

export type AiChatFailureType = (typeof AI_CHAT_FAILURE_TYPES)[keyof typeof AI_CHAT_FAILURE_TYPES];

export interface RunAiChatLifecycleInput {
  message: string;
  environment: AiEnvironment;
  providerCallsEnabled: boolean;
  now?: Date;
  userId?: string;
  useDemoUser?: boolean;
}

export interface ResolvedAiChatLifecycleInput {
  message: string;
  userId: string;
  environment: AiEnvironment;
  providerCallsEnabled: boolean;
  lifecycleStartedAt: Date;
}

/**
 * Internal Phase 6.4 result. Should not be exposed by future HTTP endpoint.
 * Replaced by COMPLETED/FAILED once provider lifecycle is implemented.
 */
export interface AiChatInitializedResult {
  status: 'INITIALIZED';
  threadId: string;
  userMessageId: string;
  generationId: string;
  userMessageSequence: number;
  lifecycleStartedAt: Date;
}

export interface AiChatGenerationRequestPolicy {
  providerName: AiProviderName;
  requestedModel: string;
  maxOutputTokens: number;
  promptVersion: string;
}

export interface CreateInitialAiChatPersistenceInput {
  lifecycleInput: ResolvedAiChatLifecycleInput;
  generationPolicy: AiChatGenerationRequestPolicy;
}

export type AiChatInitialPersistenceTransactionClient = Pick<
  Prisma.TransactionClient,
  'aiChatThread' | 'aiChatMessage' | 'aiGeneration'
>;

export interface AiChatInitialPersistencePrismaClient {
  $transaction<T>(callback: (tx: AiChatInitialPersistenceTransactionClient) => Promise<T>): Promise<T>;
}

export interface FailAiChatLifecycleInput {
  initialized: AiChatInitializedResult;
  lifecycleInput: ResolvedAiChatLifecycleInput;
  failureAt: Date;
  errorType: AiChatFailureType;
  safeErrorMessage: string;
  requestedModel: string;
  promptVersion: string;
  providerName: AiProviderName;
}

export interface AiChatFailedResult {
  status: 'FAILED';
  generationId: string;
  safeErrorMessage: string;
}

export interface AiChatFailurePersistencePrismaClient {
  $transaction<T>(callback: (tx: AiChatFailurePersistenceTransactionClient) => Promise<T>): Promise<T>;
}

export interface AiChatFailureOwnTransactionClient {
  aiGeneration: {
    update(args: Prisma.AiGenerationUpdateArgs): Promise<AiGeneration>;
  };
}

export type AiChatFailurePersistenceTransactionClient = AiChatFailureOwnTransactionClient & AiUsageLogTransactionClient;

export interface AiChatFailurePersistencePrismaClient {
  $transaction<T>(callback: (tx: AiChatFailurePersistenceTransactionClient) => Promise<T>): Promise<T>;
}

export interface AiChatFailurePersistenceUsageLedger {
  writeUsageLogInTransaction(tx: AiUsageLogTransactionClient, input: WriteAiUsageLogInput): Promise<unknown>;
}
