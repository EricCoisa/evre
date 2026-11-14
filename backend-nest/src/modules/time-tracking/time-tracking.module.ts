import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { SystemConfigurationModule } from 'src/modules/system-configuration/system-configuration.module';
import { LoggingModule } from 'src/modules/logging/logging.module';
import { FeatureFlagModule } from 'src/modules/feature-flag/feature-flag.module';
import { PdfModule } from 'src/modules/pdf/pdf.module';
import { TimeTrackingController } from './time-tracking.controller';
import { StartTimerUseCase } from './use-cases/start-timer.use-case';
import { StopTimerUseCase } from './use-cases/stop-timer.use-case';
import { GetActiveTimerUseCase } from './use-cases/get-active-timer.use-case';
import { ListTimeEntriesUseCase } from './use-cases/list-time-entries.use-case';
import { ExportTimeEntriesUseCase } from './use-cases/export-time-entries.use-case';
import { UpdateTimeEntryUseCase } from './use-cases/update-time-entry.use-case';
import { DeleteTimeEntryUseCase } from './use-cases/delete-time-entry.use-case';
import { CreateManualEntryUseCase } from './use-cases/create-manual-entry.use-case';
import { ExportTimeEntriesPdfUseCase } from './use-cases/export-time-entries-pdf.use-case';
import { StartTimerTool } from './ai-tools/start-timer.tool';
import { StopTimerTool } from './ai-tools/stop-timer.tool';
import { GetActiveTimerTool } from './ai-tools/get-active-timer.tool';
import { ListTimeEntriesTool } from './ai-tools/list-time-entries.tool';
import { CreateManualTimeEntryTool } from './ai-tools/create-manual-time-entry.tool';
import { UpdateTimeEntryTool } from './ai-tools/update-time-entry.tool';
import { DeleteTimeEntryTool } from './ai-tools/delete-time-entry.tool';
import { TimeTrackingRouteCeiling } from './time-tracking.route-ceiling';

@Module({
  imports: [
    PrismaModule,
    SystemConfigurationModule,
    LoggingModule,
    FeatureFlagModule,
    PdfModule,
  ],
  controllers: [TimeTrackingController],
  providers: [
    StartTimerUseCase,
    StopTimerUseCase,
    GetActiveTimerUseCase,
    ListTimeEntriesUseCase,
    ExportTimeEntriesUseCase,
    UpdateTimeEntryUseCase,
    DeleteTimeEntryUseCase,
    CreateManualEntryUseCase,
    ExportTimeEntriesPdfUseCase,
    StartTimerTool,
    StopTimerTool,
    GetActiveTimerTool,
    ListTimeEntriesTool,
    CreateManualTimeEntryTool,
    UpdateTimeEntryTool,
    DeleteTimeEntryTool,
    TimeTrackingRouteCeiling,
  ],
  exports: [
    StartTimerUseCase,
    StopTimerUseCase,
    GetActiveTimerUseCase,
    ListTimeEntriesUseCase,
  ],
})
export class TimeTrackingModule {}
