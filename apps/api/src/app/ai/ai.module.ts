import { Module } from '@nestjs/common';

import { AI_PROVIDER } from './ai-provider.port';
import { FakeAiProvider } from './fake-ai.provider';

@Module({
  providers: [
    FakeAiProvider,
    {
      provide: AI_PROVIDER,
      useExisting: FakeAiProvider,
    },
  ],
  exports: [AI_PROVIDER, FakeAiProvider],
})
export class AiModule {}
