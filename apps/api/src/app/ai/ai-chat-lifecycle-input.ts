import type { AiEnvironment } from '@repo/database';

export const MAX_CHAT_MESSAGE_CHARS = 4000;
export const DEMO_USER_ID = 'demo-user';

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

export class InvalidAiChatInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidAiChatInputError';
  }
}

export const countAiChatMessageChars = (value: string): number => {
  return [...value].length;
};

const trimInputString = (value: unknown, fieldName: string): string => {
  if (typeof value !== 'string') {
    throw new InvalidAiChatInputError(`${fieldName} must be a string.`);
  }

  return value.trim();
};

const resolveLifecycleStartedAt = (now: unknown): Date => {
  if (now === undefined) {
    return new Date();
  }

  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) {
    throw new InvalidAiChatInputError('now must be a valid Date.');
  }

  return now;
};

const resolveMessage = (message: unknown): string => {
  const trimmedMessage = trimInputString(message, 'message');

  if (trimmedMessage === '') {
    throw new InvalidAiChatInputError('message must be non-empty.');
  }

  if (countAiChatMessageChars(trimmedMessage) > MAX_CHAT_MESSAGE_CHARS) {
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

export const resolveAiChatLifecycleInput = (input: RunAiChatLifecycleInput): ResolvedAiChatLifecycleInput => ({
  message: resolveMessage(input.message),
  userId: resolveUserId(input),
  environment: input.environment,
  providerCallsEnabled: input.providerCallsEnabled,
  lifecycleStartedAt: resolveLifecycleStartedAt(input.now),
});
