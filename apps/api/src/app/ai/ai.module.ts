import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { AiBudgetService } from './ai-budget.service';
import { AiCostEstimatorService } from './ai-cost-estimator.service';
import { AI_PROVIDER } from './ai-provider.port';
import { AiUsageLedgerService } from './ai-usage-ledger.service';
import { FakeAiProvider } from './fake-ai.provider';

@Module({
  imports: [PrismaModule],
  providers: [
    AiBudgetService,
    AiCostEstimatorService,
    AiUsageLedgerService,
    FakeAiProvider,
    {
      provide: AI_PROVIDER,
      useExisting: FakeAiProvider,
    },
  ],
  exports: [AI_PROVIDER, AiBudgetService, AiCostEstimatorService, AiUsageLedgerService, FakeAiProvider],
})
export class AiModule {}
