import { Module, forwardRef } from '@nestjs/common';
import { SystemConfigurationController } from './system-configuration.controller';
import { SystemConfigurationService } from './system-configuration.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { LoggingModule } from '../logging/logging.module';
import { TasksModule } from '../tasks/tasks.module';

@Module({
  imports: [PrismaModule, LoggingModule, forwardRef(() => TasksModule)],
  controllers: [SystemConfigurationController],
  providers: [SystemConfigurationService],
  exports: [SystemConfigurationService],
})
export class SystemConfigurationModule {}
