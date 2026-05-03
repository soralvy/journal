import { AiEnvironment } from '@repo/database';

import { ResolvedAiChatLifecycleInput, RunAiChatLifecycleInput } from './ai-chat-lifecycle.types';

export const MAX_CHAT_MESSAGE_CHARS = 4000;
export const DEMO_USER_ID = 'demo-user';

export class InvalidAiChatInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidAiChatInputError';
  }
}

export const countAiChatMessageCodePoints = (value: string): number => {
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

  return new Date(now);
};

const resolveMessage = (message: unknown): string => {
  const trimmedMessage = trimInputString(message, 'message');

  if (trimmedMessage === '') {
    throw new InvalidAiChatInputError('message must be non-empty.');
  }

  if (countAiChatMessageCodePoints(trimmedMessage) > MAX_CHAT_MESSAGE_CHARS) {
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

const AI_ENVIRONMENTS = new Set<AiEnvironment>(Object.values(AiEnvironment) as AiEnvironment[]);

const resolveEnvironment = (environment: unknown): AiEnvironment => {
  if (typeof environment !== 'string' || !AI_ENVIRONMENTS.has(environment as AiEnvironment)) {
    throw new InvalidAiChatInputError('environment must be a valid AiEnvironment.');
  }

  return environment as AiEnvironment;
};

const resolveProviderCallsEnabled = (value: unknown): boolean => {
  if (typeof value !== 'boolean') {
    throw new InvalidAiChatInputError('providerCallsEnabled must be a boolean.');
  }

  return value;
};

const assertInputObject: (input: unknown) => asserts input is RunAiChatLifecycleInput = (input) => {
  if (input === null || typeof input !== 'object') {
    throw new InvalidAiChatInputError('input must be an object.');
  }
};

export const resolveAiChatLifecycleInput = (input: RunAiChatLifecycleInput): ResolvedAiChatLifecycleInput => {
  assertInputObject(input);

  return {
    message: resolveMessage(input.message),
    userId: resolveUserId(input),
    environment: resolveEnvironment(input.environment),
    providerCallsEnabled: resolveProviderCallsEnabled(input.providerCallsEnabled),
    lifecycleStartedAt: resolveLifecycleStartedAt(input.now),
  };
};
