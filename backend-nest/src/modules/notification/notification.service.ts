import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { I18nService } from 'nestjs-i18n';
import { RedisService } from 'src/common/infrastructure/redis/redis.service';
import {
  SendNotificationUseCase,
  type SendNotificationInput,
} from './use-cases/send-notification.use-case';
import {
  NOTIFICATION_DEBOUNCE_QUEUE,
  type NotifyDebouncedInput,
} from './notification-debounce.const';

/** Ponto de entrada para outros módulos chamarem notificação por injeção — ver docs/backend/use-cases.md. */
@Injectable()
export class NotificationService {
  constructor(
    private readonly sendNotification: SendNotificationUseCase,
    @InjectQueue(NOTIFICATION_DEBOUNCE_QUEUE)
    private readonly debounceQueue: Queue,
    private readonly redis: RedisService,
    private readonly i18n: I18nService,
  ) {}

  async notify(input: SendNotificationInput): Promise<void> {
    return this.sendNotification.execute(input);
  }

  /** Deduplicado por `jobId === bufferKey` no BullMQ; em caso de falha de Redis/fila dispara `notify()` imediato. */
  async notifyDebounced(input: NotifyDebouncedInput): Promise<void> {
    const { delayMs, item, ...jobData } = input;
    try {
      await this.redis.rpush(input.bufferKey, item);
      await this.debounceQueue.add(NOTIFICATION_DEBOUNCE_QUEUE, jobData, {
        jobId: input.bufferKey,
        delay: delayMs,
        removeOnComplete: true,
        removeOnFail: true,
      });
    } catch {
      const args = { item, count: 1, items: item };
      await this.sendNotification.execute({
        type: input.type,
        recipients: { userIds: [input.recipientUserId] },
        title: this.i18n.t(input.titleKey, { args }),
        message: this.i18n.t(input.messageKey, { args }),
        actionUrl: input.actionUrl,
        channels: input.channels,
      });
    }
  }
}
