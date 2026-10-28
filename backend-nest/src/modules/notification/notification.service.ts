import { Injectable } from '@nestjs/common';
import {
  SendNotificationUseCase,
  type SendNotificationInput,
} from './use-cases/send-notification.use-case';

/** Ponto de entrada para outros módulos chamarem notificação por injeção — ver docs/backend/use-cases.md. */
@Injectable()
export class NotificationService {
  constructor(private readonly sendNotification: SendNotificationUseCase) {}

  async notify(input: SendNotificationInput): Promise<void> {
    return this.sendNotification.execute(input);
  }
}
