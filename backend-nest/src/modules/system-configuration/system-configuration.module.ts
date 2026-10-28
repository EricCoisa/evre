import { Module, forwardRef } from '@nestjs/common';
import { SystemConfigurationController } from './system-configuration.controller';
import { SystemConfigurationService } from './system-configuration.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { LoggingModule } from '../logging/logging.module';
import { TasksModule } from '../tasks/tasks.module';
import { FindAllSystemConfigurationUseCase } from './use-cases/find-all.use-case';
import { FindOneSystemConfigurationUseCase } from './use-cases/find-one.use-case';
import { FindSystemConfigByLabelKeyUseCase } from './use-cases/find-by-label-key.use-case';
import { CreateSystemConfigurationUseCase } from './use-cases/create.use-case';
import { UpdateSystemConfigurationUseCase } from './use-cases/update.use-case';
import { RemoveSystemConfigurationUseCase } from './use-cases/remove.use-case';
import { CryptoModule } from '../../common/infrastructure/crypto/crypto.module';
import { ListSystemConfigurationTool } from './ai-tools/list-system-configuration.tool';
import { GetSystemConfigurationTool } from './ai-tools/get-system-configuration.tool';
import { GetSystemConfigurationByKeyTool } from './ai-tools/get-system-configuration-by-key.tool';
import { CreateSystemConfigurationTool } from './ai-tools/create-system-configuration.tool';
import { UpdateSystemConfigurationTool } from './ai-tools/update-system-configuration.tool';
import { DeleteSystemConfigurationTool } from './ai-tools/delete-system-configuration.tool';
import { SettingsPageRouteCeiling } from './settings-page.route-ceiling';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => LoggingModule),
    forwardRef(() => TasksModule),
    CryptoModule,
  ],
  controllers: [SystemConfigurationController],
  providers: [
    SystemConfigurationService,
    FindAllSystemConfigurationUseCase,
    FindOneSystemConfigurationUseCase,
    FindSystemConfigByLabelKeyUseCase,
    CreateSystemConfigurationUseCase,
    UpdateSystemConfigurationUseCase,
    RemoveSystemConfigurationUseCase,
    ListSystemConfigurationTool,
    GetSystemConfigurationTool,
    GetSystemConfigurationByKeyTool,
    CreateSystemConfigurationTool,
    UpdateSystemConfigurationTool,
    DeleteSystemConfigurationTool,
    SettingsPageRouteCeiling,
  ],
  // FindSystemConfigByLabelKeyUseCase sai do módulo porque o PageBuilder lê a config PAGE_LAYOUTS do
  // sistema por chave (não por id) para resolver o layout padrão.
  exports: [SystemConfigurationService, FindSystemConfigByLabelKeyUseCase],
})
export class SystemConfigurationModule {}
