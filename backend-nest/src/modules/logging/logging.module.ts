import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { LoggingService } from './logging.service';
import { LoggingController } from './logging.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { ClientLogModule } from '../client-log/client-log.module';
import { AuditProcessor } from './audit.processor';
import { FindAllLogsUseCase } from './use-cases/find-all.use-case';
import { ListLoggingTool } from './ai-tools/list-logging.tool';
import { LoggingRouteCeiling } from './logging.route-ceiling';

@Module({
  imports: [
    PrismaModule,
    ClientLogModule,
    BullModule.registerQueue({ name: 'audit' }),
  ],
  providers: [
    LoggingService,
    AuditProcessor,
    FindAllLogsUseCase,
    ListLoggingTool,
    LoggingRouteCeiling,
  ],
  controllers: [LoggingController],
  exports: [LoggingService, FindAllLogsUseCase],
})
export class LoggingModule {}
