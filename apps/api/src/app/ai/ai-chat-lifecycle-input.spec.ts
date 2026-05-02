import { describe, expect, it } from '@jest/globals';
import { AiEnvironment } from '@repo/database';

import {
  DEMO_USER_ID,
  InvalidAiChatInputError,
  MAX_CHAT_MESSAGE_CHARS,
  resolveAiChatLifecycleInput,
} from './ai-chat-lifecycle-input';

describe('resolveAiChatLifecycleInput', () => {
  it('trims message and does not mutate the input object', () => {
    const now = new Date('2026-05-02T12:00:00.000Z');
    const input = {
      message: '  hello  ',
      environment: AiEnvironment.DEMO,
      providerCallsEnabled: true,
      now,
      userId: 'user-id',
    };

    const resolvedInput = resolveAiChatLifecycleInput(input);

    expect(resolvedInput).toEqual({
      message: 'hello',
      userId: 'user-id',
      environment: AiEnvironment.DEMO,
      providerCallsEnabled: true,
      lifecycleStartedAt: now,
    });
    expect(input.message).toBe('  hello  ');
  });

  it('rejects blank messages', () => {
    expect(() =>
      resolveAiChatLifecycleInput({
        message: '   ',
        environment: AiEnvironment.DEMO,
        providerCallsEnabled: true,
        userId: 'user-id',
      }),
    ).toThrow(InvalidAiChatInputError);
  });

  it('rejects messages over the max character limit after trimming', () => {
    expect(() =>
      resolveAiChatLifecycleInput({
        message: ` ${'a'.repeat(MAX_CHAT_MESSAGE_CHARS + 1)} `,
        environment: AiEnvironment.DEMO,
        providerCallsEnabled: true,
        userId: 'user-id',
      }),
    ).toThrow(InvalidAiChatInputError);
  });

  it('rejects invalid now values', () => {
    expect(() =>
      resolveAiChatLifecycleInput({
        message: 'hello',
        environment: AiEnvironment.DEMO,
        providerCallsEnabled: true,
        now: new Date('not-a-date'),
        userId: 'user-id',
      }),
    ).toThrow(InvalidAiChatInputError);
  });

  it('resolves explicit trimmed userId', () => {
    const resolvedInput = resolveAiChatLifecycleInput({
      message: 'hello',
      environment: AiEnvironment.DEMO,
      providerCallsEnabled: true,
      userId: '  user-id  ',
    });

    expect(resolvedInput.userId).toBe('user-id');
  });

  it('resolves demo-user only when demo mode is enabled', () => {
    const resolvedInput = resolveAiChatLifecycleInput({
      message: 'hello',
      environment: AiEnvironment.DEMO,
      providerCallsEnabled: true,
      useDemoUser: true,
    });

    expect(resolvedInput.userId).toBe(DEMO_USER_ID);
  });

  it('rejects missing userId when demo mode is not enabled', () => {
    expect(() =>
      resolveAiChatLifecycleInput({
        message: 'hello',
        environment: AiEnvironment.DEMO,
        providerCallsEnabled: true,
      }),
    ).toThrow(InvalidAiChatInputError);
  });

  it('rejects whitespace userId instead of falling back to demo-user mode', () => {
    expect(() =>
      resolveAiChatLifecycleInput({
        message: 'hello',
        environment: AiEnvironment.DEMO,
        providerCallsEnabled: true,
        userId: '   ',
        useDemoUser: true,
      }),
    ).toThrow(InvalidAiChatInputError);
  });
});
