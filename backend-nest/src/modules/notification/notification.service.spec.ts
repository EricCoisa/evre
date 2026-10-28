import { NotificationService } from './notification.service';
import { SendNotificationUseCase } from './use-cases/send-notification.use-case';

describe('NotificationService', () => {
  let service: NotificationService;
  const sendNotification = { execute: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new NotificationService(
      sendNotification as unknown as SendNotificationUseCase,
    );
  });

  it('notify delega para SendNotificationUseCase', async () => {
    const input = { userId: 'u1', title: 'Oi', body: 'Mensagem' };
    sendNotification.execute.mockResolvedValue(undefined);

    await service.notify(input as never);

    expect(sendNotification.execute).toHaveBeenCalledWith(input);
  });

  it('propaga erro do use-case', async () => {
    sendNotification.execute.mockRejectedValue(new Error('falhou'));

    await expect(
      service.notify({ userId: 'u1' } as never),
    ).rejects.toThrow('falhou');
  });
});
