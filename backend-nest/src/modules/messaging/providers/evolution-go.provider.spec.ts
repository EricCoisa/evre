import { EvolutionGoProvider } from './evolution-go.provider';
import type { EvolutionGoConfig } from './evolution-go.provider';
import { GO_PLAIN_CONFIG } from '../test-utils/messaging-fixtures';

const cfg: EvolutionGoConfig = {
  ...GO_PLAIN_CONFIG,
  baseUrl: 'http://evolution-go:8080',
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

describe('EvolutionGoProvider', () => {
  let provider: EvolutionGoProvider;

  beforeEach(() => {
    vi.restoreAllMocks();
    provider = new EvolutionGoProvider();
  });
  afterEach(() => vi.unstubAllGlobals());

  describe('unregisterWebhook', () => {
    it('desconecta a instância e remove suas assinaturas de eventos', async () => {
      const fetchSpy = mockFetch({ body: { success: true } });

      const result = await provider.use(cfg).unregisterWebhook!();

      const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('http://evolution-go:8080/instance/disconnect');
      expect(init.method).toBe('POST');
      expect((init.headers as Record<string, string>).apikey).toBe(
        cfg.instanceToken,
      );
      expect(result).toMatchObject({ status: true });
    });
  });

  it('configSchema exige baseUrl válida e token', () => {
    expect(provider.configSchema.safeParse(cfg).success).toBe(true);
    expect(
      provider.configSchema.safeParse({ ...cfg, baseUrl: 'x' }).success,
    ).toBe(false);
    expect(provider.configSchema.safeParse({ ...cfg, token: '' }).success).toBe(
      false,
    );
  });

  it('configSchema exige instanceId e instanceToken (gerados pelo sistema, não digitados)', () => {
    expect(
      provider.configSchema.safeParse({ ...cfg, instanceId: '' }).success,
    ).toBe(false);
    expect(
      provider.configSchema.safeParse({ ...cfg, instanceToken: '' }).success,
    ).toBe(false);
  });

  describe('systemFields', () => {
    it('gera instanceId e instanceToken na primeira vez', () => {
      const fields = provider.systemFields();
      expect(fields.instanceId).toMatch(/^[0-9a-f-]{36}$/);
      expect(fields.instanceToken).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('mantém os valores anteriores entre edições', () => {
      expect(
        provider.systemFields({
          instanceId: 'fixo-id',
          instanceToken: 'fixo-token',
        }),
      ).toEqual({ instanceId: 'fixo-id', instanceToken: 'fixo-token' });
    });
  });

  describe('send', () => {
    // A divergência que mais custa caro: rota do Go não tem instância no path.
    it('usa /send/text SEM instância no path, autenticado pelo token DA INSTÂNCIA', async () => {
      const fetchSpy = mockFetch({
        body: { success: true, messageId: '3EB0GO' },
      });

      const result = await provider
        .use(cfg)
        .send({ type: 'TEXT', phone: '551187654321', text: 'oi' });

      const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('http://evolution-go:8080/send/text');
      expect(url).not.toContain('/message/sendText');
      expect((init.headers as Record<string, string>).apikey).toBe(
        cfg.instanceToken,
      );
      // 9º dígito canonizado na origem.
      expect(JSON.parse(init.body as string)).toEqual({
        number: '5511987654321',
        text: 'oi',
      });
      expect(result.providerMessageId).toBe('3EB0GO');
    });

    it('cai para data.Info.ID quando messageId não vem', async () => {
      mockFetch({ body: { data: { Info: { ID: '3EB0FALLBACK' } } } });
      const result = await provider
        .use(cfg)
        .send({ type: 'TEXT', phone: '5511999999999', text: 'x' });
      expect(result.providerMessageId).toBe('3EB0FALLBACK');
    });

    it('erro HTTP vira exceção com a mensagem do provider', async () => {
      mockFetch({ ok: false, status: 401, body: { error: 'invalid apikey' } });
      await expect(
        provider
          .use(cfg)
          .send({ type: 'TEXT', phone: '5511999999999', text: 'x' }),
      ).rejects.toThrow(/401.*invalid apikey/);
    });

    it('200 sem id é falha', async () => {
      mockFetch({ body: { success: true } });
      await expect(
        provider
          .use(cfg)
          .send({ type: 'TEXT', phone: '5511999999999', text: 'x' }),
      ).rejects.toThrow(/sem devolver messageId/);
    });

    it('tipo desconhecido lança UnsupportedMessageTypeError sem tocar na rede', async () => {
      const fetchSpy = mockFetch();
      await expect(
        provider
          .use(cfg)
          .send({ type: 'POLL', phone: '5511999999999' } as never),
      ).rejects.toThrow(/EVOLUTION_GO não suporta mensagem do tipo POLL/);
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe('sendPresence (POST /message/presence)', () => {
    it('composing e paused mandam state; isAudio só em RECORDING', async () => {
      const fetchSpy = mockFetch({ body: {} }, { body: {} }, { body: {} });
      await provider.use(cfg).sendPresence!('5511987654321', 'COMPOSING');
      await provider.use(cfg).sendPresence!('5511987654321', 'RECORDING');
      await provider.use(cfg).sendPresence!('5511987654321', 'PAUSED');

      const bodies = fetchSpy.mock.calls.map(
        ([, init]) => JSON.parse((init as RequestInit).body as string),
      );
      expect(fetchSpy.mock.calls[0][0]).toBe('http://evolution-go:8080/message/presence');
      expect(bodies[0]).toEqual({ number: '5511987654321', state: 'composing', isAudio: false });
      expect(bodies[1]).toEqual({ number: '5511987654321', state: 'composing', isAudio: true });
      expect(bodies[2]).toEqual({ number: '5511987654321', state: 'paused', isAudio: false });
    });
  });

  describe('validateConfiguration (GET /instance/info/:id, chave global)', () => {
    it('instância existente: sonda e devolve o estado', async () => {
      const fetchSpy = mockFetch({ body: { data: { connected: true } } });
      const res = await provider.use(cfg).validateConfiguration();

      const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`http://evolution-go:8080/instance/info/${cfg.instanceId}`);
      expect((init.headers as Record<string, string>).apikey).toBe(cfg.token);
      expect(res).toEqual({ status: true, data: 'connected=true' });
    });

    // Sessão caída não é credencial ruim — separa gravação de health.
    it('connected=false ainda aprova a gravação', async () => {
      mockFetch({ body: { data: { connected: false } } });
      const res = await provider.use(cfg).validateConfiguration();
      expect(res).toEqual({ status: true, data: 'connected=false' });
    });

    // 404 aqui prova a chave global (rota alcançada): só falta criar a instância ao conectar.
    it('404 ainda aprova a chave — a instância é criada só ao conectar', async () => {
      mockFetch({ ok: false, status: 404, body: {} });
      const res = await provider.use(cfg).validateConfiguration();
      expect(res.status).toBe(true);
      expect(res.data).toContain('instância ainda não criada');
    });

    it('401 reprova (chave global errada)', async () => {
      mockFetch({ ok: false, status: 401, body: { error: 'unauthorized' } });
      const res = await provider.use(cfg).validateConfiguration();
      expect(res).toEqual({ status: false, data: 'unauthorized' });
    });

    it('rede fora do ar vira ProviderResult falso', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockRejectedValue(new Error('ECONNREFUSED')),
      );
      const res = await provider.use(cfg).validateConfiguration();
      expect(res).toEqual({ status: false, data: 'ECONNREFUSED' });
    });
  });

  describe('deleteInstance (DELETE /instance/delete/:id, chave global)', () => {
    it('apaga sob a chave global, não o token da instância', async () => {
      const fetchSpy = mockFetch({ body: { success: true } });
      const res = await provider.use(cfg).deleteInstance!();

      const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(
        `http://evolution-go:8080/instance/delete/${cfg.instanceId}`,
      );
      expect(init.method).toBe('DELETE');
      expect((init.headers as Record<string, string>).apikey).toBe(cfg.token);
      expect(res).toEqual({ status: true, data: 'Instância apagada' });
    });

    it('instância inexistente vira ProviderResult falso, não exceção', async () => {
      mockFetch({ ok: false, status: 404, body: { error: 'not found' } });
      const res = await provider.use(cfg).deleteInstance!();
      expect(res).toEqual({ status: false, data: 'not found' });
    });

    it('rede fora do ar vira ProviderResult falso', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockRejectedValue(new Error('ECONNREFUSED')),
      );
      const res = await provider.use(cfg).deleteInstance!();
      expect(res).toEqual({ status: false, data: 'ECONNREFUSED' });
    });
  });
});
