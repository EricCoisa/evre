import { Module } from '@nestjs/common';
import { UserConfigurationDefinitionController } from './user-configuration-definition.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { LoggingModule } from '../logging/logging.module';
import { CryptoModule } from '../../common/infrastructure/crypto/crypto.module';
import { FindAllUserConfigDefinitionsUseCase } from './use-cases/find-all.use-case';
import { FindOneUserConfigDefinitionUseCase } from './use-cases/find-one.use-case';
import { CreateUserConfigDefinitionUseCase } from './use-cases/create.use-case';
import { UpdateUserConfigDefinitionUseCase } from './use-cases/update.use-case';
import { RemoveUserConfigDefinitionUseCase } from './use-cases/remove.use-case';
import { FindUserConfigDefinitionByLabelKeyUseCase } from './use-cases/find-by-label-key.use-case';
import { SetDefinitionDefaultUseCase } from './use-cases/set-definition-default.use-case';
import { ListUserConfigurationDefinitionsTool } from './ai-tools/list-user-configuration-definitions.tool';
import { GetUserConfigurationDefinitionTool } from './ai-tools/get-user-configuration-definition.tool';
import { GetUserConfigurationDefinitionByKeyTool } from './ai-tools/get-user-configuration-definition-by-key.tool';
import { CreateUserConfigurationDefinitionTool } from './ai-tools/create-user-configuration-definition.tool';
import { UpdateUserConfigurationDefinitionTool } from './ai-tools/update-user-configuration-definition.tool';
import { DeleteUserConfigurationDefinitionTool } from './ai-tools/delete-user-configuration-definition.tool';

@Module({
  imports: [PrismaModule, LoggingModule, CryptoModule],
  controllers: [UserConfigurationDefinitionController],
  providers: [
    FindAllUserConfigDefinitionsUseCase,
    FindOneUserConfigDefinitionUseCase,
    CreateUserConfigDefinitionUseCase,
    UpdateUserConfigDefinitionUseCase,
    RemoveUserConfigDefinitionUseCase,
    FindUserConfigDefinitionByLabelKeyUseCase,
    SetDefinitionDefaultUseCase,
    ListUserConfigurationDefinitionsTool,
    GetUserConfigurationDefinitionTool,
    GetUserConfigurationDefinitionByKeyTool,
    CreateUserConfigurationDefinitionTool,
    UpdateUserConfigurationDefinitionTool,
    DeleteUserConfigurationDefinitionTool,
  ],
  exports: [
    FindAllUserConfigDefinitionsUseCase,
    FindOneUserConfigDefinitionUseCase,
    CreateUserConfigDefinitionUseCase,
    UpdateUserConfigDefinitionUseCase,
    RemoveUserConfigDefinitionUseCase,
    FindUserConfigDefinitionByLabelKeyUseCase,
    SetDefinitionDefaultUseCase,
  ],
})
export class UserConfigurationDefinitionModule {}
