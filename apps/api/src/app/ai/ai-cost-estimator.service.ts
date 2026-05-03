import { Injectable } from '@nestjs/common';

import { AI_DEFAULT_MODEL } from './ai-model-policy';
import { type AiProviderName, type AiTokenUsage } from './ai-provider.port';

const TOKENS_PER_MILLION = 1_000_000n;

const OPENAI_GPT_5_4_NANO_PRICING_MICRO_USD_PER_MILLION = {
  input: 200_000,
  cachedInput: 20_000,
  output: 1_250_000,
} as const;

export interface AiCostEstimateInput {
  providerName: AiProviderName;
  model?: string;
  usage: AiTokenUsage;
}

export class InvalidAiTokenUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidAiTokenUsageError';
  }
}

const assertValidTokenCount = (name: string, value: number): void => {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new InvalidAiTokenUsageError(`${name} must be a non-negative safe integer`);
  }
};

const getReasoningTokens = (usage: AiTokenUsage): number => {
  return usage.reasoningTokens ?? 0;
};

const assertValidUsage = (usage: AiTokenUsage): void => {
  assertValidTokenCount('inputTokens', usage.inputTokens);
  assertValidTokenCount('cachedInputTokens', usage.cachedInputTokens);
  assertValidTokenCount('outputTokens', usage.outputTokens);
  assertValidTokenCount('totalTokens', usage.totalTokens);
  assertValidTokenCount('reasoningTokens', getReasoningTokens(usage));

  if (usage.cachedInputTokens > usage.inputTokens) {
    throw new InvalidAiTokenUsageError('cachedInputTokens cannot exceed inputTokens');
  }

  if (getReasoningTokens(usage) > 0) {
    throw new InvalidAiTokenUsageError('reasoningTokens are not supported in the MVP model policy');
  }
};

const divideRoundUp = (numerator: bigint, denominator: bigint): bigint => {
  if (numerator === 0n) {
    return 0n;
  }

  return (numerator + denominator - 1n) / denominator;
};

const calculateTokenCostMicroUsd = (tokens: number, priceMicroUsdPerMillion: number): number => {
  const cost = divideRoundUp(BigInt(tokens) * BigInt(priceMicroUsdPerMillion), TOKENS_PER_MILLION);

  return Number(cost);
};

@Injectable()
export class AiCostEstimatorService {
  estimateCostMicroUsd(input: AiCostEstimateInput): number {
    assertValidUsage(input.usage);

    if (input.providerName === 'FAKE') {
      return 0;
    }

    if (input.providerName === 'OPENAI' && input.model === AI_DEFAULT_MODEL) {
      const uncachedInputTokens = input.usage.inputTokens - input.usage.cachedInputTokens;

      return (
        calculateTokenCostMicroUsd(uncachedInputTokens, OPENAI_GPT_5_4_NANO_PRICING_MICRO_USD_PER_MILLION.input) +
        calculateTokenCostMicroUsd(
          input.usage.cachedInputTokens,
          OPENAI_GPT_5_4_NANO_PRICING_MICRO_USD_PER_MILLION.cachedInput,
        ) +
        calculateTokenCostMicroUsd(input.usage.outputTokens, OPENAI_GPT_5_4_NANO_PRICING_MICRO_USD_PER_MILLION.output)
      );
    }

    throw new InvalidAiTokenUsageError(
      `Unsupported AI pricing target: ${input.providerName}/${input.model ?? 'unknown'}`,
    );
  }
}
