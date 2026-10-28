import { UnauthorizedException } from '@nestjs/common';
import { ReceiveWebhookUseCase } from './receive-webhook.use-case';

describe('ReceiveWebhookUseCase', () => {
  const conn = { id: 'c1', provider: 'EVOLUTION_API' };
  const adapter = { verifyWebhook: vi.fn(), parseWebhook: vi.fn() };
  const messaging = { ingest: vi.fn(),
    dropIgnored: vi.fn((e: unknown) => Promise.resolve(e)), emitPresence: vi.fn() };
  const webhooks = { webhookKey: vi.fn() };
  const connections = {
    getActive: vi.fn(),
    list: vi.fn(),
    use: vi.fn(),
  };
  const queue = { add: vi.fn() };
  let useCase: ReceiveWebhookUseCase;

  const req = (
    query: Record<string, string> = { key: 'k', connection: 'c1' },
    body = '{"a":1}',
  ) => ({ raw: Buffer.from(body), headers: {}, query }) as never;

  beforeEach(() => {
    vi.clearAllMocks();
    webhooks.webhookKey.mockResolvedValue('k');
    connections.getActive.mockResolvedValue(conn);
    connections.list.mockResolvedValue([conn]);
    connections.use.mockReturnValue(adapter);
    adapter.verifyWebhook.mockReturnValue(true);
    adapter.parseWebhook.mockReturnValue([]);
    useCase = new ReceiveWebhookUseCase(
      messaging as never,
      webhooks as never,
      connections as never,
      queue as never,
    );
  });

  it('enfileira o corpo junto da conexão do webhook', async () => {
    await expect(useCase.execute(req())).resolves.toEqual({ accepted: true });
    expect(queue.add).toHaveBeenCalledWith(
      'inbound',
      { connectionId: 'c1', body: { a: 1 } },
      expect.any(Object),
    );
  });

  it('chave errada é 401 antes de qualquer outra coisa', async () => {
    await expect(
      useCase.execute(req({ key: 'x', connection: 'c1' })),
    ).rejects.toThrow(UnauthorizedException);
    expect(connections.getActive).not.toHaveBeenCalled();
  });

  // A chave da URL é a autenticação de base dos três providers. Sem ela configurada, aceitar tudo
  // deixaria qualquer um forjar mensagens, status e eventos de conexão.
  it.each([null, ''])(
    'sem chave configurada (%j) o webhook recusa tudo, mesmo sem key na URL',
    async (configured) => {
      webhooks.webhookKey.mockResolvedValue(configured);
      await expect(useCase.execute(req({ connection: 'c1' }))).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(
        useCase.execute(req({ key: '', connection: 'c1' })),
      ).rejects.toThrow(UnauthorizedException);
      expect(connections.getActive).not.toHaveBeenCalled();
      expect(queue.add).not.toHaveBeenCalled();
    },
  );

  it('webhook legado (sem connection) com uma única conexão cai nela', async () => {
    await useCase.execute(req({ key: 'k' }));
    expect(queue.add).toHaveBeenCalledWith(
      'inbound',
      expect.objectContaining({ connectionId: 'c1' }),
      expect.any(Object),
    );
  });

  it('sem connection e com várias conexões é 401', async () => {
    connections.list.mockResolvedValue([conn, { id: 'c2' }]);
    await expect(useCase.execute(req({ key: 'k' }))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  // instanceId agora é nosso (UUID gerado ao criar a conexão): o `?connection=` da URL sempre
  // existe, não há mais fallback por instanceId/instanceName do corpo.
  it('sem connection e com instanceId no corpo, mas várias conexões, é 401', async () => {
    connections.list.mockResolvedValue([conn, { id: 'c2' }]);
    await expect(
      useCase.execute(req({ key: 'k' }, '{"instanceId":"inst-go"}')),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('connection desconhecida é 401', async () => {
    connections.getActive.mockRejectedValue(new Error('404'));
    await expect(
      useCase.execute(req({ key: 'k', connection: 'zzz' })),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('conexão arquivada é 401 e não enfileira eventos', async () => {
    connections.getActive.mockRejectedValue(new Error('connection archived'));
    await expect(useCase.execute(req())).rejects.toThrow(UnauthorizedException);
    expect(connections.use).not.toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('assinatura do provider inválida é 401', async () => {
    adapter.verifyWebhook.mockReturnValue(false);
    await expect(useCase.execute(req())).rejects.toThrow(UnauthorizedException);
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('corpo que não é JSON é 401, não 500', async () => {
    await expect(useCase.execute(req(undefined, 'não json'))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('sem fila, processa na hora', async () => {
    const direct = new ReceiveWebhookUseCase(
      messaging as never,
      webhooks as never,
      connections as never,
      null,
    );
    await direct.execute(req());
    expect(messaging.ingest).toHaveBeenCalledWith('c1', { a: 1 });
  });

  describe('presença — não entra na fila', () => {
    const presence = { kind: 'PRESENCE', phone: '5511987654321', state: 'COMPOSING' };

    it('repassa direto pro relé realtime e não enfileira nem chama ingest', async () => {
      adapter.parseWebhook.mockReturnValue([presence]);
      await expect(useCase.execute(req())).resolves.toEqual({ accepted: true });
      expect(queue.add).not.toHaveBeenCalled();
      expect(messaging.ingest).not.toHaveBeenCalled();
      expect(messaging.emitPresence).toHaveBeenCalledWith('c1', presence);
    });

    it('evento vazio (nada relevante no payload) não é tratado como presença: segue pra fila', async () => {
      adapter.parseWebhook.mockReturnValue([]);
      await useCase.execute(req());
      expect(queue.add).toHaveBeenCalled();
      expect(messaging.emitPresence).not.toHaveBeenCalled();
    });
  });
});
