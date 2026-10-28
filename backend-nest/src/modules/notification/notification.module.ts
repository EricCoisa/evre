import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { FeatureFlagModule } from '../feature-flag/feature-flag.module';
import { SystemConfigurationModule } from '../system-configuration/system-configuration.module';
import { EmailModule } from '../email/email.module';
import { MessagingModule } from '../messaging/messaging.module';
import { VerificationModule } from '../verification/verification.module';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { SendNotificationUseCase } from './use-cases/send-notification.use-case';
import { MaterializeBroadcastRecipientsUseCase } from './use-cases/materialize-broadcast-recipients.use-case';
import { ListMyNotificationsUseCase } from './use-cases/list-my-notifications.use-case';
import { GetUnreadCountUseCase } from './use-cases/get-unread-count.use-case';
import { MarkReadUseCase } from './use-cases/mark-read.use-case';
import { MarkAllReadUseCase } from './use-cases/mark-all-read.use-case';
import { DismissNotificationUseCase } from './use-cases/dismiss.use-case';
import { SendBroadcastNotificationUseCase } from './use-cases/send-broadcast-notification.use-case';
import { NotificationCapabilities } from './notification.capabilities';
import { ListMyNotificationsTool } from './ai-tools/list-my-notifications.tool';
import { GetUnreadNotificationsCountTool } from './ai-tools/get-unread-notifications-count.tool';
import { MarkNotificationReadTool } from './ai-tools/mark-notification-read.tool';
import { MarkAllNotificationsReadTool } from './ai-tools/mark-all-notifications-read.tool';
import { DismissNotificationTool } from './ai-tools/dismiss-notification.tool';
import { SendBroadcastNotificationTool } from './ai-tools/send-broadcast-notification.tool';

const USE_CASES = [
  SendNotificationUseCase,
  MaterializeBroadcastRecipientsUseCase,
  ListMyNotificationsUseCase,
  GetUnreadCountUseCase,
  MarkReadUseCase,
  MarkAllReadUseCase,
  DismissNotificationUseCase,
  SendBroadcastNotificationUseCase,
];

const AI_TOOLS = [
  ListMyNotificationsTool,
  GetUnreadNotificationsCountTool,
  MarkNotificationReadTool,
  MarkAllNotificationsReadTool,
  DismissNotificationTool,
  SendBroadcastNotificationTool,
];

// Nota: dispatch de email/WhatsApp não precisa de fila própria — EmailService e
// MessagingService já enfileiram a chamada ao provider internamente; aqui só decide
// SE chamam, de forma síncrona e rápida (poucas queries + um `queue.add()` já existente).
@Module({
  imports: [
    PrismaModule,
    FeatureFlagModule,
    SystemConfigurationModule,
    EmailModule,
    forwardRef(() => MessagingModule),
    // VerificationModule importa MessagingModule (p/ enviar WhatsApp), que por sua vez importa
    // NotificationModule de volta (forwardRef acima) — sem lazy aqui também, o 3º lado do
    // triângulo fica eager e o Nest não resolve o ciclo.
    forwardRef(() => VerificationModule),
  ],
  controllers: [NotificationController],
  providers: [
    NotificationService,
    ...USE_CASES,
    NotificationCapabilities,
    ...AI_TOOLS,
  ],
  exports: [NotificationService],
})
export class NotificationModule {}
