import { AiProvider } from '@repo/database';

export const AI_PROVIDER = Symbol('AI_PROVIDER');

export type AiProviderName = 'FAKE' | 'OPENAI';
export type AiProviderRole = 'system' | 'user' | 'assistant';

export interface AiProviderMessage {
  role: AiProviderRole;
  content: string;
}

export interface AiTokenUsage {
  /**
   * Total provider input tokens. This includes cached input tokens.
   * Uncached input tokens are computed as inputTokens - cachedInputTokens.
   */
  inputTokens: number;
  /** Cached input tokens are a subset of inputTokens. */
  cachedInputTokens: number;
  outputTokens: number;
  reasoningTokens?: number;
  totalTokens: number;
}

export interface AiProviderGenerateInput {
  messages: readonly AiProviderMessage[];
  model: string;
  maxOutputTokens: number;
}

export interface AiProviderGenerateResult {
  providerName: AiProviderName;
  model: string;
  text: string;
  finishReason: string;
  usage: AiTokenUsage;
}

export interface AiProviderPort {
  generate(input: AiProviderGenerateInput): Promise<AiProviderGenerateResult>;
}

export const mapAiProviderNameToDbProvider = (providerName: AiProviderName): AiProvider => {
  switch (providerName) {
    case 'FAKE': {
      return AiProvider.FAKE;
    }
    case 'OPENAI': {
      return AiProvider.OPENAI;
    }
  }
};
