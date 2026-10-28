import { Module, forwardRef } from '@nestjs/common';
import { BullModule, getQueueToken } from '@nestjs/bullmq';
import { NotificationModule } from 'src/modules/notification/notification.module';
import type { Queue } from 'bullmq';
import { PrismaModule } from 'src/prisma/prisma.module';
import { CryptoModule } from 'src/common/infrastructure/crypto/crypto.module';
import { SystemConfigurationModule } from 'src/modules/system-configuration/system-configuration.module';
import { FeatureFlagModule } from 'src/modules/feature-flag/feature-flag.module';
import { MessagingService } from './messaging.service';
import { ContactProfileSyncService } from './contact-profile-sync.service';
import { MessagingWebhookService } from './messaging-webhook.service';
import { MessagingTemplateService } from './messaging-template.service';
import { MessagingSessionStore } from './messaging-session.store';
import { MessagingEventsService } from './messaging-events.service';
import { MessagingConnectionService } from './messaging-connection.service';
import { MessagingConnectionStateService } from './messaging-connection-state.service';
import { MessagingProviderRegistry } from './messaging-provider.registry';
import { SEND_PROCESSORS } from './messaging.processor';
import {
  MESSAGING_QUEUE,
  MESSAGING_SEND_QUEUES,
  SEND_QUEUE_NAMES,
} from './messaging-queue.const';
import { MessagingInboundProcessor } from './messaging-inbound.processor';
import { MessagingController } from './messaging.controller';
import { MessagingTemplateController } from './messaging-template.controller';
import { CreateConnectionUseCase } from './use-cases/create-connection.use-case';
import { UpdateConnectionUseCase } from './use-cases/update-connection.use-case';
import { SetDefaultConnectionUseCase } from './use-cases/set-default-connection.use-case';
import { ArchiveConnectionUseCase } from './use-cases/archive-connection.use-case';
import { RestoreConnectionUseCase } from './use-cases/restore-connection.use-case';
import { ListConnectionsUseCase } from './use-cases/list-connections.use-case';
import { CheckConnectionHealthUseCase } from './use-cases/check-health.use-case';
import { ListMessagesUseCase } from './use-cases/list-messages.use-case';
import { GetContactPhotoUseCase } from './use-cases/get-contact-photo.use-case';
import { GetMessageMediaUseCase } from './use-cases/get-message-media.use-case';
import { ListContactsUseCase } from './use-cases/list-contacts.use-case';
import { CreateContactUseCase } from './use-cases/create-contact.use-case';
import { UpdateContactUseCase } from './use-cases/update-contact.use-case';
import { ListConversationsUseCase } from './use-cases/list-conversations.use-case';
import { ReceiveWebhookUseCase } from './use-cases/receive-webhook.use-case';
import { VerifyWebhookChallengeUseCase } from './use-cases/verify-challenge.use-case';
import { MessagingSessionUseCase } from './use-cases/session.use-case';
import { SendMessageUseCase } from './use-cases/send-message.use-case';
import { SendPresenceUseCase } from './use-cases/send-presence.use-case';
import { GetCapabilitiesUseCase } from './use-cases/get-capabilities.use-case';
import { ListTemplateTypesUseCase } from './use-cases/list-template-types.use-case';
import { GetTemplateTypeUseCase } from './use-cases/get-template-type.use-case';
import { CreateTemplateTypeUseCase } from './use-cases/create-template-type.use-case';
import { UpdateTemplateTypeUseCase } from './use-cases/update-template-type.use-case';
import { RemoveTemplateTypeUseCase } from './use-cases/remove-template-type.use-case';
import { ListTemplatesUseCase } from './use-cases/list-templates.use-case';
import { GetTemplateUseCase } from './use-cases/get-template.use-case';
import { CreateTemplateUseCase } from './use-cases/create-template.use-case';
import { UpdateTemplateUseCase } from './use-cases/update-template.use-case';
import { RemoveTemplateUseCase } from './use-cases/remove-template.use-case';
import { SubmitTemplateUseCase } from './use-cases/submit-template.use-case';
import { ReconcileTemplateSubmissionsUseCase } from './use-cases/reconcile-template-submissions.use-case';
import { ListTemplateVariablesUseCase } from './use-cases/list-template-variables.use-case';
import { ListTemplateButtonsUseCase } from './use-cases/list-template-buttons.use-case';
import { CheckMetaTemplateUseCase } from './use-cases/check-meta-template.use-case';
import { ListRemoteTemplatesUseCase } from './use-cases/list-remote-templates.use-case';
import { LinkRemoteTemplateUseCase } from './use-cases/link-remote-template.use-case';
import { ImportRemoteTemplateUseCase } from './use-cases/import-remote-template.use-case';
import { ButtonHandlerRegistry } from './button-handler.registry';
import { MessagingButtonEventService } from './messaging-button-events.service';
import { MessagingButtonProcessor } from './messaging-button.processor';
import { ReservedButtonHandlers } from './reserved-button.handlers';
import { EvolutionApiProvider } from './providers/evolution-api.provider';
import { EvolutionGoProvider } from './providers/evolution-go.provider';
import { MetaProvider } from './providers/meta.provider';
import { SendWhatsappMessageTool } from './ai-tools/send-whatsapp-message.tool';
import { GetMessagingConfigTool } from './ai-tools/get-messaging-config.tool';
import { ListWhatsappMessagesTool } from './ai-tools/list-whatsapp-messages.tool';
import { SendWhatsappTemplateTool } from './ai-tools/send-whatsapp-template.tool';
import { ListWhatsappTemplatesTool } from './ai-tools/list-whatsapp-templates.tool';
import { CreateWhatsappTemplateTool } from './ai-tools/create-whatsapp-template.tool';
import { SubmitWhatsappTemplateTool } from './ai-tools/submit-whatsapp-template.tool';
import { ListWhatsappTemplateTypesTool } from './ai-tools/list-whatsapp-template-types.tool';
import { MessagingCapabilities } from './messaging.capabilities';
import { MessagingRouteCeiling } from './messaging.route-ceiling';

@Module({
  imports: [
    PrismaModule,
    SystemConfigurationModule,
    CryptoModule,
    FeatureFlagModule,
    forwardRef(() => NotificationModule),
    BullModule.registerQueue(...SEND_QUEUE_NAMES.map((name) => ({ name }))),
    BullModule.registerQueue({ name: MESSAGING_QUEUE.INBOUND }),
    BullModule.registerQueue({ name: MESSAGING_QUEUE.BUTTONS }),
  ],
  controllers: [MessagingController, MessagingTemplateController],
  providers: [
    MessagingService,
    ContactProfileSyncService,
    MessagingWebhookService,
    MessagingTemplateService,
    MessagingSessionStore,
    MessagingEventsService,
    MessagingProviderRegistry,
    MessagingConnectionService,
    MessagingConnectionStateService,
    ...SEND_PROCESSORS,
    {
      provide: MESSAGING_SEND_QUEUES,
      useFactory: (...queues: Queue[]) => queues,
      inject: SEND_QUEUE_NAMES.map((name) => getQueueToken(name)),
    },
    MessagingInboundProcessor,
    SendMessageUseCase,
    SendPresenceUseCase,
    GetCapabilitiesUseCase,
    ListTemplateTypesUseCase,
    GetTemplateTypeUseCase,
    CreateTemplateTypeUseCase,
    UpdateTemplateTypeUseCase,
    RemoveTemplateTypeUseCase,
    ListTemplatesUseCase,
    GetTemplateUseCase,
    CreateTemplateUseCase,
    UpdateTemplateUseCase,
    RemoveTemplateUseCase,
    SubmitTemplateUseCase,
    ReconcileTemplateSubmissionsUseCase,
    ListTemplateVariablesUseCase,
    ListTemplateButtonsUseCase,
    CheckMetaTemplateUseCase,
    ListRemoteTemplatesUseCase,
    LinkRemoteTemplateUseCase,
    ImportRemoteTemplateUseCase,
    ButtonHandlerRegistry,
    MessagingButtonEventService,
    MessagingButtonProcessor,
    ReservedButtonHandlers,
    CreateConnectionUseCase,
    UpdateConnectionUseCase,
    SetDefaultConnectionUseCase,
    ArchiveConnectionUseCase,
    RestoreConnectionUseCase,
    ListConnectionsUseCase,
    ReceiveWebhookUseCase,
    VerifyWebhookChallengeUseCase,
    MessagingSessionUseCase,
    CheckConnectionHealthUseCase,
    ListMessagesUseCase,
    GetMessageMediaUseCase,
    GetContactPhotoUseCase,
    ListContactsUseCase,
    CreateContactUseCase,
    UpdateContactUseCase,
    ListConversationsUseCase,
    EvolutionApiProvider,
    EvolutionGoProvider,
    MetaProvider,
    SendWhatsappMessageTool,
    GetMessagingConfigTool,
    ListWhatsappMessagesTool,
    SendWhatsappTemplateTool,
    ListWhatsappTemplatesTool,
    ListWhatsappTemplateTypesTool,
    CreateWhatsappTemplateTool,
    SubmitWhatsappTemplateTool,
    MessagingCapabilities,
    MessagingRouteCeiling,
  ],
  exports: [
    MessagingService,
    MessagingTemplateService,
    MessagingConnectionService,
    ButtonHandlerRegistry,
  ],
})
export class MessagingModule {}
