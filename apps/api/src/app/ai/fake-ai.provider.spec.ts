import { describe, expect, it } from '@jest/globals';
import { Test } from '@nestjs/testing';

import { AiModule } from './ai.module';
import { AI_DEFAULT_MODEL, AI_MAX_OUTPUT_TOKENS, getMvpAiModelPolicy, isMvpAiModelAllowed } from './ai-model-policy';
import { AI_PROVIDER, type AiProviderPort } from './ai-provider.port';
import { FakeAiProvider } from './fake-ai.provider';

describe('FakeAiProvider', () => {
  it('returns a deterministic response and usage-like metadata', async () => {
    const provider = new FakeAiProvider();

    await expect(
      provider.generate({
        model: AI_DEFAULT_MODEL,
        maxOutputTokens: AI_MAX_OUTPUT_TOKENS,
        messages: [{ role: 'user', content: 'What patterns do you notice?' }],
      }),
    ).resolves.toEqual({
      providerName: 'FAKE',
      model: AI_DEFAULT_MODEL,
      text: 'Fake assistant response: What patterns do you notice?',
      finishReason: 'stop',
      usage: {
        inputTokens: 1,
        cachedInputTokens: 0,
        outputTokens: 1,
        totalTokens: 2,
      },
    });
  });

  it('uses the last user message for the deterministic response', async () => {
    const provider = new FakeAiProvider();

    await expect(
      provider.generate({
        model: AI_DEFAULT_MODEL,
        maxOutputTokens: AI_MAX_OUTPUT_TOKENS,
        messages: [
          { role: 'user', content: 'Earlier question' },
          { role: 'assistant', content: 'Earlier answer' },
          { role: 'user', content: 'Latest question' },
        ],
      }),
    ).resolves.toMatchObject({
      text: 'Fake assistant response: Latest question',
      usage: {
        inputTokens: 3,
        cachedInputTokens: 0,
        outputTokens: 1,
        totalTokens: 4,
      },
    });
  });

  it('is the only provider registered by AiModule for tests', async () => {
    const module = await Test.createTestingModule({
      imports: [AiModule],
    }).compile();

    const provider = module.get<AiProviderPort>(AI_PROVIDER);

    expect(provider).toBeInstanceOf(FakeAiProvider);
  });
});

describe('MVP AI model policy', () => {
  it('uses gpt-5.4-nano with an 800 token output cap by default', () => {
    expect(getMvpAiModelPolicy()).toEqual({
      model: 'gpt-5.4-nano',
      maxOutputTokens: 800,
      reasoning: {
        deepModeEnabled: false,
        highReasoningEnabled: false,
        xhighReasoningEnabled: false,
      },
    });
  });

  it('does not allow strong or deep-mode models in the MVP policy', () => {
    expect(isMvpAiModelAllowed('gpt-5.4-nano')).toBe(true);
    expect(isMvpAiModelAllowed('gpt-5.4-mini')).toBe(false);
    expect(isMvpAiModelAllowed('gpt-5.4')).toBe(false);
    expect(isMvpAiModelAllowed('gpt-5.5')).toBe(false);
  });
});
