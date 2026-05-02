import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { AiBudgetService } from './ai-budget.service';
import { AiChatLifecycleService } from './ai-chat-lifecycle.service';
import { AiCostEstimatorService } from './ai-cost-estimator.service';
import { AiJournalContextService } from './ai-journal-context.service';
import { AI_PROVIDER } from './ai-provider.port';
import { AiUsageLedgerService } from './ai-usage-ledger.service';
import { FakeAiProvider } from './fake-ai.provider';

@Module({
  imports: [PrismaModule],
  providers: [
    AiBudgetService,
    AiChatLifecycleService,
    AiCostEstimatorService,
    AiJournalContextService,
    AiUsageLedgerService,
    FakeAiProvider,
    {
      provide: AI_PROVIDER,
      useExisting: FakeAiProvider,
    },
  ],
  exports: [
    AI_PROVIDER,
    AiBudgetService,
    AiChatLifecycleService,
    AiCostEstimatorService,
    AiJournalContextService,
    AiUsageLedgerService,
    FakeAiProvider,
  ],
})
export class AiModule {}
