import { Injectable } from '@nestjs/common';
import { NotificationService } from '../notification.service';
import { NotificationType } from 'src/domain/notification/notification-type.const';
import type { SendBroadcastNotificationDto } from '../dto/send-broadcast-notification.dto';

/** Composer admin: só monta o input e delega pro mesmo `notify()` que qualquer outro módulo usa. */
@Injectable()
export class SendBroadcastNotificationUseCase {
  constructor(private readonly notificationService: NotificationService) {}

  async execute(
    dto: SendBroadcastNotificationDto,
    createdById: string,
  ): Promise<void> {
    await this.notificationService.notify({
      type: NotificationType.SYSTEM_ANNOUNCEMENT,
      recipients: dto.all ? { all: true } : { roleNames: dto.roleNames },
      title: dto.title,
      message: dto.message,
      actionUrl: dto.actionUrl,
      createdById,
      // Mesma lógica do UpdatePasswordUseCase: pede os dois canais sempre — o que realmente
      // dispara é decidido pelas camadas de baixo (flag de plataforma por canal em
      // SystemConfiguration, preferência de mute por usuário), não pelo chamador aqui.
      channels: { email: true, whatsapp: true },
    });
  }
}
