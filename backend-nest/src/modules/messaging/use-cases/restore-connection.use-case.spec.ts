import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { RestoreConnectionUseCase } from './restore-connection.use-case';
import type { MessagingConnectionService } from '../messaging-connection.service';
import type { MessagingProviderRegistry } from '../messaging-provider.registry';
import type { MessagingService } from '../messaging.service';
import type { MessagingWebhookService } from '../messaging-webhook.service';
import type { MessagingConnectionStateService } from '../messaging-connection-state.service';
import type { MessagingEventsService } from '../messaging-events.service';
import type { SystemConfigurationService } from 'src/modules/system-configuration/system-configuration.service';
import type { I18nService } from 'nestjs-i18n';

describe('RestoreConnectionUseCase', () => {
  const archivedConn = {
    id: 'conn-1',
    provider: 'EVOLUTION_API',
    phone: '5511999999999',
    archivedAt: new Date(),
    config: {},
  };
  const activeConn = {
    ...archivedConn,
    archivedAt: null,
  };

  const connections = {
    get: vi.fn(),
    findByProvider: vi.fn(),
    plainConfig: vi.fn(),
    encode: vi.fn(),
    unarchive: vi.fn(),
    view: vi.fn(),
  };
  const registry = {
    get: vi.fn(),
  };
  const messaging = {
    inspectCandidate: vi.fn(),
  };
  const webhooks = {
    registerWebhookReport: vi.fn(),
  };
  const state = { reset: vi.fn() };
  const events = { emit: vi.fn() };
  const systemConfig = { setManyByLabelKey: vi.fn() };
  const i18n = {
    t: vi.fn((key: string, args?: unknown) => `${key}${args ? ` ${JSON.stringify(args)}` : ''}`),
  } as unknown as I18nService;

  let useCase: RestoreConnectionUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    connections.get.mockResolvedValue(archivedConn);
    connections.findByProvider.mockResolvedValue(null);
    connections.plainConfig.mockReturnValue({ baseUrl: 'http://test:8080' });
    connections.encode.mockReturnValue({ baseUrl: 'http://test:8080' });
    connections.unarchive.mockResolvedValue(activeConn);
    connections.view.mockReturnValue({ id: 'conn-1', archived: false });
    registry.get.mockReturnValue({ configSchema: { parse: vi.fn() } });
    messaging.inspectCandidate.mockResolvedValue({
      result: { status: true, data: 'ok' },
      accountPhone: null,
    });
    webhooks.registerWebhookReport.mockResolvedValue({ status: true, data: 'registered' });

    useCase = new RestoreConnectionUseCase(
      connections as unknown as MessagingConnectionService,
      registry as unknown as MessagingProviderRegistry,
      messaging as unknown as MessagingService,
      webhooks as unknown as MessagingWebhookService,
      state as unknown as MessagingConnectionStateService,
      events as unknown as MessagingEventsService,
      systemConfig as unknown as SystemConfigurationService,
      i18n,
    );
  });

  it('recusa restaurar conexão que não está arquivada', async () => {
    connections.get.mockResolvedValue({ ...archivedConn, archivedAt: null });

    await expect(useCase.execute('conn-1')).rejects.toThrow(BadRequestException);
  });

  it('recusa trocar o provider durante a restauração', async () => {
    await expect(
      useCase.execute('conn-1', { provider: 'META' as never }),
    ).rejects.toThrow(BadRequestException);
  });

  it('recusa se já houver conexão ativa para o mesmo provider', async () => {
    connections.findByProvider.mockResolvedValue({ id: 'conn-2', provider: 'EVOLUTION_API' });

    await expect(useCase.execute('conn-1')).rejects.toThrow(ConflictException);
  });

  it('recusa se a validação das credenciais no provider falhar', async () => {
    messaging.inspectCandidate.mockResolvedValue({
      result: { status: false, data: 'Credenciais inválidas' },
      accountPhone: null,
    });

    await expect(useCase.execute('conn-1')).rejects.toThrow(BadRequestException);
  });

  it('recusa se o número da conta retornado for diferente do número da conexão', async () => {
    messaging.inspectCandidate.mockResolvedValue({
      result: { status: true, data: 'ok' },
      accountPhone: '5511888888888', // diferente de 5511999999999
    });

    await expect(useCase.execute('conn-1')).rejects.toThrow(BadRequestException);
  });

  it('restaura com sucesso, reseta estado, registra webhook e emite evento', async () => {
    const result = await useCase.execute('conn-1', undefined, 'user-1');

    expect(connections.unarchive).toHaveBeenCalledWith('conn-1', { baseUrl: 'http://test:8080' }, undefined);
    expect(state.reset).toHaveBeenCalledWith('conn-1');
    expect(webhooks.registerWebhookReport).toHaveBeenCalledWith('conn-1');
    expect(events.emit).toHaveBeenCalledWith({ type: 'connection' });
    expect(result.connection.id).toBe('conn-1');
    expect(result.connection.archived).toBe(false);
  });
});

