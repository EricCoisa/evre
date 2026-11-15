import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { I18nService } from 'nestjs-i18n';
import { RedisService } from 'src/common/infrastructure/redis/redis.service';
import { SendNotificationUseCase } from './use-cases/send-notification.use-case';
import {
  NOTIFICATION_DEBOUNCE_QUEUE,
  type NotificationDebounceJobData,
} from './notification-debounce.const';

@Processor(NOTIFICATION_DEBOUNCE_QUEUE)
export class NotificationDebounceProcessor extends WorkerHost {
  constructor(
    private readonly sendNotification: SendNotificationUseCase,
    private readonly redis: RedisService,
    private readonly i18n: I18nService,
  ) {
    super();
  }

  async process(job: Job<NotificationDebounceJobData>): Promise<void> {
    const { bufferKey, recipientUserId, type, actionUrl, channels, titleKey, messageKey } =
      job.data;

    const items = await this.redis.lrange(bufferKey);
    if (items.length === 0) return;

    const plural = items.length > 1 ? '_plural' : '';
    const args = { item: items[0] ?? '', items: items.join(', '), count: items.length };

    await this.sendNotification.execute({
      type,
      recipients: { userIds: [recipientUserId] },
      title: this.i18n.t(`${titleKey}${plural}`, { args }),
      message: this.i18n.t(`${messageKey}${plural}`, { args }),
      actionUrl,
      channels,
    });

    await this.redis.del(bufferKey);
  }
}
