import { Injectable } from '@nestjs/common';

import { type AiProviderGenerateInput, type AiProviderGenerateResult, type AiProviderPort } from './ai-provider.port';

const getLastUserMessage = (input: AiProviderGenerateInput): string => {
  const lastUserMessage = input.messages.findLast((message) => message.role === 'user');

  return lastUserMessage?.content ?? '';
};

const createFakeGenerateResult = (input: AiProviderGenerateInput): AiProviderGenerateResult => {
  const lastUserMessage = getLastUserMessage(input);
  const text = `Fake assistant response: ${lastUserMessage}`;
  const inputTokens = input.messages.length;
  const outputTokens = 1;

  return {
    provider: 'FAKE',
    model: input.model,
    text,
    finishReason: 'stop',
    usage: {
      inputTokens,
      cachedInputTokens: 0,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
    },
  };
};

@Injectable()
export class FakeAiProvider implements AiProviderPort {
  generate(input: AiProviderGenerateInput): Promise<AiProviderGenerateResult> {
    return Promise.resolve(createFakeGenerateResult(input));
  }
}
