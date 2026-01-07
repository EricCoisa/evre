import { Module } from '@nestjs/common';
import { UserConfigurationService } from './user-configuration.service';
import { UserConfigurationController } from './user-configuration.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { LoggingModule } from '../logging/logging.module';

@Module({
  imports: [PrismaModule, LoggingModule],
  controllers: [UserConfigurationController],
  providers: [UserConfigurationService],
  exports: [UserConfigurationService],
})
export class UserConfigurationModule {}
