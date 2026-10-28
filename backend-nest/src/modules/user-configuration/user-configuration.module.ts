import { Module } from '@nestjs/common';
import { UserConfigurationService } from './user-configuration.service';
import { UserConfigurationController } from './user-configuration.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { LoggingModule } from '../logging/logging.module';
import { CryptoModule } from '../../common/infrastructure/crypto/crypto.module';
import { GetUserConfigurationsUseCase } from './use-cases/get-user-configurations.use-case';
import { GetUserConfigurationByKeyUseCase } from './use-cases/get-by-key.use-case';
import { SetUserConfigurationUseCase } from './use-cases/set-user-configuration.use-case';
import { ResetUserConfigurationUseCase } from './use-cases/reset-user-configuration.use-case';
import { ResetAllUserConfigurationsUseCase } from './use-cases/reset-all.use-case';
import { SetUserConfigurationTool } from './ai-tools/set-user-configurations.tool';
import { GetMyConfigurationsTool } from './ai-tools/get-my-configurations.tool';
import { GetMyConfigurationByKeyTool } from './ai-tools/get-my-configuration-by-key.tool';
import { ResetMyConfigurationTool } from './ai-tools/reset-my-configuration.tool';
import { ResetAllMyConfigurationsTool } from './ai-tools/reset-all-my-configurations.tool';

const useCases = [
  GetUserConfigurationsUseCase,
  GetUserConfigurationByKeyUseCase,
  SetUserConfigurationUseCase,
  ResetUserConfigurationUseCase,
  ResetAllUserConfigurationsUseCase,
];

const aiTools = [
  SetUserConfigurationTool,
  GetMyConfigurationsTool,
  GetMyConfigurationByKeyTool,
  ResetMyConfigurationTool,
  ResetAllMyConfigurationsTool,
];

@Module({
  imports: [PrismaModule, LoggingModule, CryptoModule],
  controllers: [UserConfigurationController],
  providers: [UserConfigurationService, ...useCases, ...aiTools],
  exports: [UserConfigurationService, ...useCases],
})
export class UserConfigurationModule {}
