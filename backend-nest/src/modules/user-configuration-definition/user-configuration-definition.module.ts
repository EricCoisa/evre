import { Module } from '@nestjs/common';
import { UserConfigurationDefinitionController } from './user-configuration-definition.controller';
import { UserConfigurationDefinitionService } from './user-configuration-definition.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { LoggingModule } from '../logging/logging.module';

@Module({
  imports: [PrismaModule, LoggingModule],
  controllers: [UserConfigurationDefinitionController],
  providers: [UserConfigurationDefinitionService],
  exports: [UserConfigurationDefinitionService],
})
export class UserConfigurationDefinitionModule {}
