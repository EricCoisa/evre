import { Module, forwardRef } from '@nestjs/common';

import { RefreshTokenClearTask } from './refreshTokenClear.task';

import { PrismaModule } from '../../prisma/prisma.module';
import { SystemConfigurationModule } from '../system-configuration/system-configuration.module';
import { LoggingModule } from '../logging/logging.module';
import { LogClearTask } from './logClear.task';
import { SignupIntentClearTask } from './signup-intent-clear.task';

// forwardRef: dependência circular LoggingModule ↔ TasksModule.
@Module({
  imports: [
    PrismaModule,
    forwardRef(() => SystemConfigurationModule),
    forwardRef(() => LoggingModule),
  ],
  providers: [LogClearTask, RefreshTokenClearTask, SignupIntentClearTask],
  exports: [LogClearTask],
})
export class TasksModule {}
