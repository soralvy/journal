import { describe, expect, it } from '@jest/globals';

import { AiCostEstimatorService, InvalidAiTokenUsageError } from './ai-cost-estimator.service';
import { AI_DEFAULT_MODEL } from './ai-model-policy';

describe('AiCostEstimatorService', () => {
  const service = new AiCostEstimatorService();

  it('estimates fake provider usage at zero cost', () => {
    expect(
      service.estimateCostMicroUsd({
        providerName: 'FAKE',
        model: AI_DEFAULT_MODEL,
        usage: {
          inputTokens: 100,
          cachedInputTokens: 25,
          outputTokens: 50,
          totalTokens: 150,
        },
      }),
    ).toBe(0);
  });

  it('uses gpt-5.4-nano standard pricing for uncached input, cached input, and output tokens', () => {
    expect(
      service.estimateCostMicroUsd({
        providerName: 'OPENAI',
        model: AI_DEFAULT_MODEL,
        usage: {
          inputTokens: 1000,
          cachedInputTokens: 200,
          outputTokens: 300,
          totalTokens: 1300,
        },
      }),
    ).toBe(539);
  });

  it('rejects usage when cached input tokens exceed input tokens', () => {
    expect(() =>
      service.estimateCostMicroUsd({
        providerName: 'OPENAI',
        model: AI_DEFAULT_MODEL,
        usage: {
          inputTokens: 10,
          cachedInputTokens: 11,
          outputTokens: 1,
          totalTokens: 11,
        },
      }),
    ).toThrow(InvalidAiTokenUsageError);
  });

  it('rejects negative token counts', () => {
    expect(() =>
      service.estimateCostMicroUsd({
        providerName: 'OPENAI',
        model: AI_DEFAULT_MODEL,
        usage: {
          inputTokens: -1,
          cachedInputTokens: 0,
          outputTokens: 1,
          totalTokens: 0,
        },
      }),
    ).toThrow(InvalidAiTokenUsageError);
  });

  it('rejects non-integer token counts', () => {
    expect(() =>
      service.estimateCostMicroUsd({
        providerName: 'OPENAI',
        model: AI_DEFAULT_MODEL,
        usage: {
          inputTokens: 1.5,
          cachedInputTokens: 0,
          outputTokens: 1,
          totalTokens: 2,
        },
      }),
    ).toThrow(InvalidAiTokenUsageError);
  });

  it('rejects reasoning tokens because the MVP has no reasoning mode', () => {
    expect(() =>
      service.estimateCostMicroUsd({
        providerName: 'OPENAI',
        model: AI_DEFAULT_MODEL,
        usage: {
          inputTokens: 1,
          cachedInputTokens: 0,
          outputTokens: 1,
          reasoningTokens: 1,
          totalTokens: 3,
        },
      }),
    ).toThrow(InvalidAiTokenUsageError);
  });

  it('rejects unsupported provider/model pricing targets', () => {
    expect(() =>
      service.estimateCostMicroUsd({
        providerName: 'OPENAI',
        model: 'gpt-5.4-mini',
        usage: {
          inputTokens: 1,
          cachedInputTokens: 0,
          outputTokens: 1,
          totalTokens: 2,
        },
      }),
    ).toThrow(InvalidAiTokenUsageError);
  });
});
