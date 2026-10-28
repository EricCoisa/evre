import { EvolutionApiProvider } from './evolution-api.provider';
import type { EvolutionApiConfig } from './evolution-api.provider';

const cfg: EvolutionApiConfig = {
  baseUrl: 'http://evolution:8080/',
  token: 'tok-123',
  instance: 'minha-instancia',
};

function mockFetch(
  ...responses: Array<{ ok?: boolean; status?: number; body?: unknown }>
) {
  const fn = vi.fn();
  for (const r of responses) {
    fn.mockResolvedValueOnce({
      ok: r.ok ?? true,
      status: r.status ?? 200,
      statusText: 'STATUS',
      json: () => Promise.resolve(r.body ?? null),
    });
  }
  vi.stubGlobal('fetch', fn);
  return fn;
}

describe('EvolutionApiProvider', () => {
  let provider: EvolutionApiProvider;

  beforeEach(() => {
    vi.restoreAllMocks();
    provider = new EvolutionApiProvider();
  });
  afterEach(() => vi.unstubAllGlobals());

  describe('unregisterWebhook', () => {
    it('preserva a configuração atual, desativa o webhook e confirma o estado', async () => {
      const fetchSpy = mockFetch(
        {
          body: {
            enabled: true,
            url: 'https://app.example.com/webhook',
            webhookByEvents: false,
            webhookBase64: false,
            events: ['MESSAGES_UPSERT'],
          },
        },
        { body: { webhook: { enabled: false } } },
        {
          body: {
            enabled: false,
            url: 'https://app.example.com/webhook',
            events: ['MESSAGES_UPSERT'],
          },
        },
      );

      const result = await provider.use(cfg).unregisterWebhook!();

      expect(fetchSpy.mock.calls.map(([url]) => url)).toEqual([
        'http://evolution:8080/webhook/find/minha-instancia',
        'http://evolution:8080/webhook/set/minha-instancia',
        'http://evolution:8080/webhook/find/minha-instancia',
      ]);
      const [setUrl, init] = fetchSpy.mock.calls[1] as [string, RequestInit];
      expect(setUrl).toBe('http://evolution:8080/webhook/set/minha-instancia');
      expect(init.method).toBe('POST');
      expect((init.headers as Record<string, string>).apikey).toBe('tok-123');
      expect(JSON.parse(init.body as string)).toEqual({
        webhook: {
          enabled: false,
          url: 'https://app.example.com/webhook',
          byEvents: false,
          base64: false,
          events: ['MESSAGES_UPSERT'],
        },
      });
      expect(result).toMatchObject({ status: true });
    });

    it('retorna falha se a Evolution não fornecer a URL obrigatória para alterar o webhook', async () => {
      mockFetch({ body: { enabled: true } });

      await expect(provider.use(cfg).unregisterWebhook!()).resolves.toEqual({
        status: false,
        data: 'Evolution API não retornou a URL atual do webhook; não foi possível desativá-lo com segurança',
      });
    });

    it('retorna falha se o webhook continuar habilitado após a atualização', async () => {
      mockFetch(
        { body: { enabled: true, url: 'https://app.example.com/webhook' } },
        { body: {} },
        { body: { enabled: true, url: 'https://app.example.com/webhook' } },
      );

      await expect(provider.use(cfg).unregisterWebhook!()).resolves.toEqual({
        status: false,
        data: 'Evolution API aceitou a solicitação, mas o webhook continua habilitado',
      });
    });
  });

  describe('configSchema', () => {
    it('reprova baseUrl inválida, token e instance vazios — sem tocar na rede', () => {
      const fetchSpy = mockFetch();
      expect(
        provider.configSchema.safeParse({
          baseUrl: 'nao-e-url',
          token: 'a',
          instance: 'b',
        }).success,
      ).toBe(false);
      expect(
        provider.configSchema.safeParse({
          baseUrl: 'http://x',
          token: '',
          instance: 'b',
        }).success,
      ).toBe(false);
      expect(
        provider.configSchema.safeParse({
          baseUrl: 'http://x',
          token: 'a',
          instance: '',
        }).success,
      ).toBe(false);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('aceita config completa', () => {
      expect(provider.configSchema.safeParse(cfg).success).toBe(true);
    });
  });

  describe('send', () => {
    it('monta a rota e o corpo da v2 — instância no path, body achatado', async () => {
      const fetchSpy = mockFetch({ body: { key: { id: '3EB0ABC' } } });

      const result = await provider
        .use(cfg)
        .send({ type: 'TEXT', phone: '+55 (11) 98765-4321', text: 'oi' });

      const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      // Barra final da baseUrl não pode virar barra dupla.
      expect(url).toBe(
        'http://evolution:8080/message/sendText/minha-instancia',
      );
      expect(init.method).toBe('POST');
      expect((init.headers as Record<string, string>).apikey).toBe('tok-123');
      expect(JSON.parse(init.body as string)).toEqual({
        number: '5511987654321',
        text: 'oi',
      });
      expect(result.providerMessageId).toBe('3EB0ABC');
    });

    it('usa key.id como providerMessageId (não o formato do Evolution Go)', async () => {
      mockFetch({ body: { key: { id: 'ID-CERTO' }, messageId: 'ID-DO-GO' } });
      const result = await provider
        .use(cfg)
        .send({ type: 'TEXT', phone: '5511999999999', text: 'x' });
      expect(result.providerMessageId).toBe('ID-CERTO');
    });

    it('erro HTTP vira exceção com a mensagem do provider', async () => {
      mockFetch({ ok: false, status: 401, body: { message: 'Unauthorized' } });
      await expect(
        provider
          .use(cfg)
          .send({ type: 'TEXT', phone: '5511999999999', text: 'x' }),
      ).rejects.toThrow(/401.*Unauthorized/);
    });

    it('200 sem key.id é falha, não sucesso silencioso', async () => {
      mockFetch({ body: {} });
      await expect(
        provider
          .use(cfg)
          .send({ type: 'TEXT', phone: '5511999999999', text: 'x' }),
      ).rejects.toThrow(/sem devolver key.id/);
    });

    // Tipos de mídia e template são suportados (send-media.spec.ts); o guard cobre o resto.
    it('tipo desconhecido lança UnsupportedMessageTypeError sem tocar na rede', async () => {
      const fetchSpy = mockFetch();
      await expect(
        provider
          .use(cfg)
          .send({ type: 'LOCATION', phone: '5511999999999' } as never),
      ).rejects.toThrow(/não suporta mensagem do tipo LOCATION/);
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe('sendPresence', () => {
    it('POST /chat/sendPresence com number, presence e delay (obrigatório no schema da Evolution)', async () => {
      const fetchSpy = mockFetch({ body: {} });
      await provider.use(cfg).sendPresence!('5511987654321', 'COMPOSING');

      const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('http://evolution:8080/chat/sendPresence/minha-instancia');
      expect(JSON.parse(init.body as string)).toMatchObject({
        number: '5511987654321',
        presence: 'composing',
      });
      expect(JSON.parse(init.body as string).delay).toBeGreaterThan(0);
    });

    it('RECORDING e PAUSED traduzem para recording/paused', async () => {
      const fetchSpy = mockFetch({ body: {} }, { body: {} });
      await provider.use(cfg).sendPresence!('5511987654321', 'RECORDING');
      await provider.use(cfg).sendPresence!('5511987654321', 'PAUSED');

      expect(JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string).presence).toBe(
        'recording',
      );
      expect(JSON.parse((fetchSpy.mock.calls[1][1] as RequestInit).body as string).presence).toBe(
        'paused',
      );
    });
  });

  describe('validateConfiguration', () => {
    it('sonda connectionState e devolve o state', async () => {
      const fetchSpy = mockFetch({ body: { instance: { state: 'open' } } });
      const res = await provider.use(cfg).validateConfiguration();

      expect(fetchSpy.mock.calls[0][0]).toBe(
        'http://evolution:8080/instance/connectionState/minha-instancia',
      );
      expect(res).toEqual({ status: true, data: 'open' });
    });

    it('sessão caída ainda é credencial válida (não reprova a gravação)', async () => {
      mockFetch({ body: { instance: { state: 'close' } } });
      const res = await provider.use(cfg).validateConfiguration();
      expect(res.status).toBe(true);
    });

    it('credencial ruim reprova com a mensagem do provider', async () => {
      mockFetch({ ok: false, status: 401, body: { message: 'Unauthorized' } });
      const res = await provider.use(cfg).validateConfiguration();
      expect(res).toEqual({ status: false, data: 'Unauthorized' });
    });

    // Issue #2216: connectionState some em algumas instalações v2.3.6.
    it('404 no connectionState cai para fetchInstances em vez de reprovar', async () => {
      const fetchSpy = mockFetch(
        { ok: false, status: 404 },
        { ok: true, body: [] },
      );
      const res = await provider.use(cfg).validateConfiguration();

      expect(fetchSpy.mock.calls[1][0]).toBe(
        'http://evolution:8080/instance/fetchInstances',
      );
      expect(res.status).toBe(true);
    });

    it('404 nos dois = instância inexistente', async () => {
      mockFetch({ ok: false, status: 404 }, { ok: false, status: 404 });
      const res = await provider.use(cfg).validateConfiguration();
      expect(res.status).toBe(false);
      expect(res.data).toMatch(/minha-instancia/);
    });

    it('rede fora do ar vira ProviderResult falso, não exceção', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockRejectedValue(new Error('ECONNREFUSED')),
      );
      const res = await provider.use(cfg).validateConfiguration();
      expect(res).toEqual({ status: false, data: 'ECONNREFUSED' });
    });
  });
});
