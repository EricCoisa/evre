import { NotificationService } from './notification.service';
import { SendNotificationUseCase } from './use-cases/send-notification.use-case';
import { RedisService } from 'src/common/infrastructure/redis/redis.service';
import { I18nService } from 'nestjs-i18n';
import type { Queue } from 'bullmq';

describe('NotificationService', () => {
  let service: NotificationService;
  const sendNotification = { execute: vi.fn() };
  const debounceQueue = { add: vi.fn() } as unknown as Queue;
  const redis = { rpush: vi.fn(), lrange: vi.fn(), del: vi.fn() };
  const i18n = { t: vi.fn().mockImplementation((key: string) => key) };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new NotificationService(
      sendNotification as unknown as SendNotificationUseCase,
      debounceQueue,
      redis as unknown as RedisService,
      i18n as unknown as I18nService,
    );
  });

  it('notify delega para SendNotificationUseCase', async () => {
    const input = { type: 'TEST', recipients: { userIds: ['u1'] }, title: 'Oi', message: 'Msg' };
    sendNotification.execute.mockResolvedValue(undefined);

    await service.notify(input as never);

    expect(sendNotification.execute).toHaveBeenCalledWith(input);
  });

  it('propaga erro do use-case', async () => {
    sendNotification.execute.mockRejectedValue(new Error('falhou'));

    await expect(service.notify({ type: 'TEST' } as never)).rejects.toThrow('falhou');
  });

  it('notifyDebounced empurra item no buffer e agenda job', async () => {
    redis.rpush.mockResolvedValue(undefined);
    (debounceQueue.add as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    await service.notifyDebounced({
      bufferKey: 'notif-debounce:task-assigned:user-1',
      delayMs: 30_000,
      item: 'Task X',
      recipientUserId: 'user-1',
      type: 'PROJECT_TASK_ASSIGNED',
      titleKey: 'project.task_assigned_title',
      messageKey: 'project.task_assigned_message',
    });

    expect(redis.rpush).toHaveBeenCalledWith('notif-debounce:task-assigned:user-1', 'Task X');
    expect(debounceQueue.add).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ recipientUserId: 'user-1' }),
      expect.objectContaining({ jobId: 'notif-debounce:task-assigned:user-1', delay: 30_000 }),
    );
  });

  it('notifyDebounced cai em notify imediato se o buffer falhar', async () => {
    redis.rpush.mockRejectedValue(new Error('redis down'));
    sendNotification.execute.mockResolvedValue(undefined);

    await service.notifyDebounced({
      bufferKey: 'notif-debounce:task-assigned:user-1',
      delayMs: 30_000,
      item: 'Task X',
      recipientUserId: 'user-1',
      type: 'PROJECT_TASK_ASSIGNED',
      titleKey: 'project.task_assigned_title',
      messageKey: 'project.task_assigned_message',
    });

    expect(sendNotification.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'project.task_assigned_title',
        message: 'project.task_assigned_message',
      }),
    );
  });
});
