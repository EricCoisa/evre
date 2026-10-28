import { MessagingWebhookService } from './messaging-webhook.service';
import { EVO, realConnections } from './test-utils/messaging-fixtures';

const okJson = (body: unknown) => ({
  ok: true,
  status: 200,
  statusText: 'OK',
  json: () => Promise.resolve(body),
});

function setup() {
  const { service: connections } = realConnections([EVO]);
  const systemConfig = { findByLabelKey: vi.fn() };
  const service = new MessagingWebhookService(
    systemConfig as never,
    connections,
    { t: (key: string) => key } as never,
  );
  return { service, systemConfig };
}

describe('MessagingWebhookService', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('a URL leva a chave do sistema E o id da conexão — é como o webhook sabe de quem é', async () => {
    const { service, systemConfig } = setup();
    process.env.NEXTAUTH_URL = 'https://app.exemplo.com';
    systemConfig.findByLabelKey.mockImplementation((key: string) =>
      Promise.resolve({
        value: key === 'SYSTEM_MESSAGING_WEBHOOK_KEY' ? 'segredo/1' : '',
      }),
    );

    expect(await service.webhookUrl('conn-evo')).toBe(
      'https://app.exemplo.com/api/messaging/webhook?key=segredo%2F1&connection=conn-evo',
    );
  });

  it('override do dev vence e não duplica barra', async () => {
    const { service, systemConfig } = setup();
    systemConfig.findByLabelKey.mockImplementation((key: string) =>
      Promise.resolve({
        value: key.endsWith('PUBLIC_URL') ? 'https://tunel.ngrok.app/' : 'k',
      }),
    );
    expect(await service.webhookUrl('c1')).toBe(
      'https://tunel.ngrok.app/api/messaging/webhook?key=k&connection=c1',
    );
  });

  /** Config do sistema com a chave do webhook preenchida (sem ela o webhook recusa tudo). */
  const withKey = (systemConfig: {
    findByLabelKey: ReturnType<typeof vi.fn>;
  }) =>
    systemConfig.findByLabelKey.mockImplementation((key: string) =>
      Promise.resolve({ value: key.endsWith('WEBHOOK_KEY') ? 'k' : '' }),
    );

  it('registra o webhook da conexão no provider dela e reporta o resultado', async () => {
    const { service, systemConfig } = setup();
    withKey(systemConfig);
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(
        okJson([{ name: 'inst', connectionStatus: 'open' }]),
      )
      .mockResolvedValueOnce(okJson({}));
    vi.stubGlobal('fetch', fetchSpy);

    const report = await service.registerWebhookReport('conn-evo');

    expect(report.registered).toBe(true);
    expect(report.url).toContain('connection=conn-evo');
    const body = JSON.parse(
      (fetchSpy.mock.calls[1][1] as RequestInit).body as string,
    );
    expect(body.webhook.url).toContain('connection=conn-evo');
  });

  it('falha no registro não lança: devolve a URL para registro manual', async () => {
    const { service, systemConfig } = setup();
    withKey(systemConfig);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    const report = await service.registerWebhookReport('conn-evo');
    expect(report.registered).toBe(false);
    expect(report.message).toContain('offline');
    expect(report.url).toContain('/api/messaging/webhook');
  });

  // Sem chave o webhook recusa tudo: uma URL "sem chave" registrada no provider só geraria 401s.
  it('sem chave configurada não existe URL: webhookUrl lança 503', async () => {
    const { service, systemConfig } = setup();
    systemConfig.findByLabelKey.mockResolvedValue({ value: '' });
    await expect(service.webhookUrl('conn-evo')).rejects.toThrow(
      'messaging.webhook_key_missing',
    );
  });

  it('webhookKey expõe a chave crua configurada no sistema', async () => {
    const { service, systemConfig } = setup();
    systemConfig.findByLabelKey.mockResolvedValue({ value: 'segredo-1' });

    await expect(service.webhookKey()).resolves.toBe('segredo-1');
  });

  it('erro real ao ler a config (não NotFoundException) propaga em vez de virar "sem chave"', async () => {
    const { service, systemConfig } = setup();
    systemConfig.findByLabelKey.mockRejectedValue(new Error('db fora'));

    await expect(service.webhookKey()).rejects.toThrow('db fora');
  });

  it('sem chave configurada o registro não chama o provider e explica o motivo', async () => {
    const { service, systemConfig } = setup();
    systemConfig.findByLabelKey.mockResolvedValue({ value: '' });
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const report = await service.registerWebhookReport('conn-evo');

    expect(report).toEqual({
      registered: false,
      url: '',
      message: 'messaging.webhook_key_missing',
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
