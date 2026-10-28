import { Module, forwardRef } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { AiService } from './ai.service';
import { ToolRegistry } from './tool-registry.service';
import { AiCheckpointerService } from './checkpointer.service';
import { AnthropicAiProvider } from './providers/anthropic.provider';
import { OpenAiProvider } from './providers/openai.provider';
import { OpenAiCompatibleProvider } from './providers/openai-compatible.provider';
import { CreateConversationUseCase } from './use-cases/create-conversation.use-case';
import { ListConversationsUseCase } from './use-cases/list-conversations.use-case';
import { GetConversationUseCase } from './use-cases/get-conversation.use-case';
import { DeleteConversationUseCase } from './use-cases/delete-conversation.use-case';
import { RewindConversationUseCase } from './use-cases/rewind-conversation.use-case';
import { SendMessageUseCase } from './use-cases/send-message.use-case';
import { ResolveApprovalUseCase } from './use-cases/resolve-approval.use-case';
import { ListMyToolPermissionsUseCase } from './use-cases/list-my-tool-permissions.use-case';
import { RevokeMyToolAccessUseCase } from './use-cases/revoke-my-tool-access.use-case';
import { AllowMyToolAccessUseCase } from './use-cases/allow-my-tool-access.use-case';
import { SaveAiConfigurationUseCase } from './use-cases/save-configuration.use-case';
import { SaveUserAiConfigurationUseCase } from './use-cases/save-user-configuration.use-case';
import { ListCandidateAiModelsUseCase } from './use-cases/list-candidate-models.use-case';
import { AiController } from './ai.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { SystemConfigurationModule } from '../system-configuration/system-configuration.module';
import { UserConfigurationModule } from '../user-configuration/user-configuration.module';
import { LoggingModule } from '../logging/logging.module';
import { RedisModule } from '../../common/infrastructure/redis/redis.module';
import { FeatureFlagModule } from '../feature-flag/feature-flag.module';

@Module({
  imports: [
    DiscoveryModule,
    PrismaModule,
    SystemConfigurationModule,
    forwardRef(() => UserConfigurationModule),
    forwardRef(() => LoggingModule),
    RedisModule,
    FeatureFlagModule,
  ],
  controllers: [AiController],
  providers: [
    AiService,
    ToolRegistry,
    AiCheckpointerService,
    AnthropicAiProvider,
    OpenAiProvider,
    OpenAiCompatibleProvider,
    CreateConversationUseCase,
    ListConversationsUseCase,
    GetConversationUseCase,
    DeleteConversationUseCase,
    RewindConversationUseCase,
    SendMessageUseCase,
    ResolveApprovalUseCase,
    ListMyToolPermissionsUseCase,
    RevokeMyToolAccessUseCase,
    AllowMyToolAccessUseCase,
    SaveAiConfigurationUseCase,
    SaveUserAiConfigurationUseCase,
    ListCandidateAiModelsUseCase,
  ],
  exports: [AiService, ToolRegistry],
})
export class AiModule {}
