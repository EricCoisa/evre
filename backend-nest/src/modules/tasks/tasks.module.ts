import { Module, forwardRef } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

import { RefreshTokenClearTask } from './refreshTokenClear.task';

import { PrismaService } from '../../prisma/prisma.service';
import { SystemConfigurationModule } from '../system-configuration/system-configuration.module';
import { LoggingModule } from '../logging/logging.module';
import { LogClearTask } from './logClear.task';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    forwardRef(() => SystemConfigurationModule),
    LoggingModule,
  ],
  providers: [LogClearTask, RefreshTokenClearTask, PrismaService],
  exports: [LogClearTask],
})
export class TasksModule {}
