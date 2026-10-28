import { MessagingSessionUseCase } from './session.use-case';
import type { MessagingConnectionService } from '../messaging-connection.service';
import type { MessagingConnectionStateService } from '../messaging-connection-state.service';
import type { MessagingWebhookService } from '../messaging-webhook.service';

describe('MessagingSessionUseCase', () => {
  const connection = { id: 'conn-1', provider: 'EVOLUTION_API' };
  const connections = { getActive: vi.fn() };
  const state = { connect: vi.fn(), status: vi.fn(), disconnect: vi.fn() };
  const webhooks = { registerWebhook: vi.fn() };
  let useCase: MessagingSessionUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    connections.getActive.mockResolvedValue(connection);
    state.connect.mockResolvedValue({
      status: 'CONNECTING',
      qrCode: 'data:...',
    });
    webhooks.registerWebhook.mockResolvedValue({ status: true, data: 'url' });
    useCase = new MessagingSessionUseCase(
      connections as unknown as MessagingConnectionService,
      state as unknown as MessagingConnectionStateService,
      webhooks as unknown as MessagingWebhookService,
    );
  });

  /** Garante que o webhook é registrado antes de pedir o QR. */
  it('registra o webhook ANTES de conectar, da conexão pedida', async () => {
    await useCase.connect('conn-1');

    expect(connections.getActive).toHaveBeenCalledWith('conn-1');
    expect(state.connect).toHaveBeenCalledWith(connection);
    expect(webhooks.registerWebhook).toHaveBeenCalledWith('conn-1');
    expect(webhooks.registerWebhook.mock.invocationCallOrder[0]).toBeLessThan(
      state.connect.mock.invocationCallOrder[0],
    );
  });

  it('falha no registro não impede o pareamento — o QR ainda volta', async () => {
    webhooks.registerWebhook.mockResolvedValue({
      status: false,
      data: 'instância offline',
    });
    await expect(useCase.connect('conn-1')).resolves.toMatchObject({
      status: 'CONNECTING',
      qrCode: 'data:...',
    });
  });

  it('status e disconnect delegam ao estado da conexão', async () => {
    state.status.mockResolvedValue({ supported: true, status: 'CONNECTED' });
    state.disconnect.mockResolvedValue({ status: true, data: 'ok' });

    expect(await useCase.status('conn-1')).toEqual({
      supported: true,
      status: 'CONNECTED',
    });
    expect(await useCase.disconnect('conn-1')).toEqual({
      status: true,
      data: 'ok',
    });
    expect(state.status).toHaveBeenCalledWith(connection);
    expect(state.disconnect).toHaveBeenCalledWith(connection);
  });
});
