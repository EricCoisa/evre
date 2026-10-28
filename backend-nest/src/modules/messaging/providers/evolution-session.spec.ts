import { EvolutionApiProvider } from './evolution-api.provider';
import { EvolutionGoProvider } from './evolution-go.provider';
import { MetaProvider } from './meta.provider';
import { GO_PLAIN_CONFIG } from '../test-utils/messaging-fixtures';

const cfg = {
  baseUrl: 'http://evo:8080',
  token: 'tok',
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

const QR = 'data:image/png;base64,iVBORw0KGgo';

describe('sessão (pareamento por QR)', () => {
  afterEach(() => vi.unstubAllGlobals());

  // A Meta não pareia: número já verificado na conta Business.
  it('Meta não expõe `session` — a UI usa isso para esconder o QR', () => {
    expect(
      new MetaProvider().use({
        phoneNumberId: '1',
        accessToken: 'a',
        graphVersion: 'v21.0',
        wabaId: 'waba-1',
      }).session,
    ).toBeUndefined();
  });

  /** O Go é provisionado pelo sistema: GET /instance/info/:id já traz número e QR persistidos numa chamada só. */
  describe('Evolution Go', () => {
    const provider = () => new EvolutionGoProvider().use(GO_PLAIN_CONFIG).session!;
    const infoUrl = `http://go:8080/instance/info/${GO_PLAIN_CONFIG.instanceId}`;
    const info = (data: Record<string, unknown>) => ({ body: { data } });

    describe('connect', () => {
      it('instância nunca criada: cria pela chave global e devolve o estado em seguida', async () => {
        const fetchSpy = mockFetch(
          { ok: false, status: 404 },
          { body: {} },
          info({ connected: false, qrcode: QR }),
        );

        expect(await provider().connect()).toEqual({
          status: 'CONNECTING',
          qrCode: QR,
        });
        expect(fetchSpy).toHaveBeenCalledTimes(3);

        const [probeUrl, probeInit] = fetchSpy.mock.calls[0] as [string, RequestInit];
        expect(probeUrl).toBe(infoUrl);
        expect((probeInit.headers as Record<string, string>).apikey).toBe(
          GO_PLAIN_CONFIG.token,
        );

        const [createUrl, createInit] = fetchSpy.mock.calls[1] as [string, RequestInit];
        expect(createUrl).toBe('http://go:8080/instance/create');
        expect(JSON.parse(createInit.body as string)).toEqual({
          instanceId: GO_PLAIN_CONFIG.instanceId,
          name: GO_PLAIN_CONFIG.instanceId,
          token: GO_PLAIN_CONFIG.instanceToken,
          advancedSettings: { ignoreGroups: true, ignoreStatus: true },
        });
      });

      it('instância já existente: não recria, só lê o estado', async () => {
        const fetchSpy = mockFetch(
          info({ connected: false, qrcode: QR }),
          info({ connected: false, qrcode: QR }),
        );

        expect(await provider().connect()).toEqual({
          status: 'CONNECTING',
          qrCode: QR,
        });
        expect(fetchSpy).toHaveBeenCalledTimes(2);
        expect(fetchSpy.mock.calls.every(([url]) => url === infoUrl)).toBe(true);
      });

      it('já conectada devolve CONNECTED com o número, sem QR', async () => {
        const jid = '5511918798714:5@s.whatsapp.net';
        mockFetch(info({ connected: true, jid }), info({ connected: true, jid }));

        expect(await provider().connect()).toEqual({
          status: 'CONNECTED',
          phoneNumber: '5511918798714',
        });
      });

      it('create recusado pela chave global devolve a causa', async () => {
        mockFetch(
          { ok: false, status: 404 },
          { ok: false, status: 401, body: { error: 'invalid global key' } },
        );
        await expect(provider().connect()).rejects.toThrow(/invalid global key/);
      });

      // A sonda do ensureInstance precisa reconhecer o GORM como "não existe": com `probe.status
      // !== 404` ela concluía "já existe" e o create NUNCA rodava.
      it('`record not found` na sonda cria a instância', async () => {
        const fetchSpy = mockFetch(
          { ok: false, status: 400, body: { error: 'record not found' } },
          { body: {} },
          info({ connected: false, qrcode: QR }),
        );

        expect(await provider().connect()).toEqual({
          status: 'CONNECTING',
          qrCode: QR,
        });
        expect(fetchSpy.mock.calls[1][0]).toBe('http://go:8080/instance/create');
      });

      // Janela entre o POST /instance/connect (assíncrono no Go) e o socket subir: sem isto, o
      // admin clicava em "Conectar" e a tela lia "Desconectado" até o webhook QRCode chegar.
      it('instância existente sem connected nem QR: connect afirma o pareamento (CONNECTING)', async () => {
        const fetchSpy = mockFetch(
          info({ connected: false }),
          info({ connected: false }),
        );

        expect(await provider().connect()).toEqual({ status: 'CONNECTING' });
        expect(fetchSpy).toHaveBeenCalledTimes(2);
      });
    });

    describe('status (GET /instance/info/:id, chave global)', () => {
      it('conectado devolve o número do jid, sem o sufixo :device', async () => {
        mockFetch(info({ connected: true, jid: '5511918798714:5@s.whatsapp.net' }));
        expect(await provider().status()).toEqual({
          status: 'CONNECTED',
          phoneNumber: '5511918798714',
        });
      });

      it('pareando (com QR persistido) é CONNECTING', async () => {
        const fetchSpy = mockFetch(info({ connected: false, qrcode: QR }));
        expect(await provider().status()).toEqual({
          status: 'CONNECTING',
          qrCode: QR,
        });
        expect(fetchSpy).toHaveBeenCalledTimes(1);
        expect(fetchSpy.mock.calls[0][0]).toBe(infoUrl);
      });

      it('sem conexão nem QR é DISCONNECTED', async () => {
        mockFetch(info({ connected: false }));
        expect(await provider().status()).toEqual({ status: 'DISCONNECTED' });
      });

      // `connected` sozinho não prova pareamento: o Go pode marcar o socket de pé antes do QR ser
      // lido. Sem o `jid`, a tela diria "conectado" sem ninguém ter pareado.
      it('connected sem jid NÃO é CONNECTED — pareamento ainda não confirmado', async () => {
        mockFetch(info({ connected: true }));
        expect(await provider().status()).toEqual({ status: 'DISCONNECTED' });
      });

      // Pareado e caído (`disconnect_reason: Reconnecting`): tem `jid`, não tem QR nem `connected`.
      it('pareado mas caído é DISCONNECTED e preserva o número', async () => {
        mockFetch(
          info({ connected: false, jid: '553492016008:34@s.whatsapp.net' }),
        );
        expect(await provider().status()).toEqual({
          status: 'DISCONNECTED',
          phoneNumber: '5534992016008',
        });
      });

      // Socket de pé antes do QR ser lido: o QR vale e NÃO pode ser suprimido — era o que fazia a
      // tela dizer "aguardando código" com o QR já no payload.
      it('connected sem jid, com QR, é CONNECTING e entrega o QR', async () => {
        mockFetch(info({ connected: true, qrcode: QR }));
        expect(await provider().status()).toEqual({
          status: 'CONNECTING',
          qrCode: QR,
        });
      });

      // O Go grava `<data URI>|<código cru>` na instância; o sufixo corrompe o base64 e o
      // navegador mostrava imagem quebrada. O webhook manda o mesmo campo já limpo.
      it('qrcode da instância vem com `|código` colado: só o data URI é entregue', async () => {
        mockFetch(info({ connected: false, qrcode: `${QR}|2@AbCd1234` }));
        expect(await provider().status()).toEqual({
          status: 'CONNECTING',
          qrCode: QR,
        });
      });

      // Valor sem data URI não é imagem: entregá-lo renderiza um <img> quebrado.
      it('qrcode que não é data URI vira CONNECTING sem QR', async () => {
        mockFetch(info({ connected: false, qrcode: '2@AbCd1234' }));
        expect(await provider().status()).toEqual({ status: 'CONNECTING' });
      });

      // O Go resolve a instância pelo id no path, sob a chave global: apagada lá, responde 404.
      it('instância apagada no provider (404) é NOT_CREATED, não erro', async () => {
        mockFetch({ ok: false, status: 404 });
        expect(await provider().status()).toEqual({ status: 'NOT_CREATED' });
      });

      // Visto na instância real: instância inexistente NÃO dá 404 — vem o erro cru do GORM em
      // outro status. Sem tratar isto, criar conexão falhava com "record not found".
      it('`record not found` do GORM é NOT_CREATED, mesmo fora do 404', async () => {
        mockFetch({ ok: false, status: 400, body: { error: 'record not found' } });
        expect(await provider().status()).toEqual({ status: 'NOT_CREATED' });
      });

      it('outro erro HTTP continua estourando', async () => {
        mockFetch({ ok: false, status: 500, body: { error: 'boom' } });
        await expect(provider().status()).rejects.toThrow(/boom/);
      });
    });

    /** A desconexão normal despareia; `/instance/disconnect` fica reservado ao arquivamento. */
    it('disconnect usa DELETE /instance/logout, não /instance/disconnect', async () => {
      const fetchSpy = mockFetch({ body: { message: 'success' } });

      expect(await provider().disconnect()).toMatchObject({ status: true });
      expect(fetchSpy).toHaveBeenCalledWith(
        'http://go:8080/instance/logout',
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });

  describe('Evolution API', () => {
    const provider = () => new EvolutionApiProvider().use(cfg).session!;

    /** `fetchInstances` filtrado pelo nome: a existência e o estado vêm de uma chamada só. */
    const listed = (...rows: unknown[]) => ({ ok: true, body: rows });
    const row = (connectionStatus: string, extra: object = {}) => ({
      name: 'minha-instancia',
      connectionStatus,
      ...extra,
    });

    it('instância inexistente é criada e devolve o QR', async () => {
      const fetchSpy = mockFetch(
        listed(), // fetchInstances: nenhuma com esse nome
        {
          ok: true,
          body: { qrcode: { base64: QR }, instance: { status: 'connecting' } },
        },
      );

      const session = await provider().connect();

      const [listUrl] = fetchSpy.mock.calls[0] as [string];
      const [createUrl, createInit] = fetchSpy.mock.calls[1] as [
        string,
        RequestInit,
      ];
      expect(listUrl).toBe(
        'http://evo:8080/instance/fetchInstances?instanceName=minha-instancia',
      );
      expect(createUrl).toBe('http://evo:8080/instance/create');
      expect(JSON.parse(createInit.body as string)).toEqual({
        instanceName: 'minha-instancia',
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS',
      });
      expect(session).toEqual({
        status: 'CONNECTING',
        qrCode: QR,
        pairingCode: undefined,
      });
    });

    // Sem isso, reabrir a tela tentaria recriar a instância e derrubaria a sessão.
    it('já conectada devolve CONNECTED sem criar nem pedir QR', async () => {
      const fetchSpy = mockFetch(listed(row('open')));

      expect(await provider().connect()).toEqual({ status: 'CONNECTED' });
      expect(fetchSpy).toHaveBeenCalledOnce();
    });

    it('instância existente mas desconectada pede QR em /instance/connect, sem recriar', async () => {
      const fetchSpy = mockFetch(listed(row('close')), {
        ok: true,
        body: { qrcode: { base64: QR, pairingCode: 'ABC123' } },
      });

      const session = await provider().connect();

      expect(fetchSpy.mock.calls[1][0]).toBe(
        'http://evo:8080/instance/connect/minha-instancia',
      );
      expect(session).toMatchObject({
        status: 'CONNECTING',
        qrCode: QR,
        pairingCode: 'ABC123',
      });
    });

    it('create que falha (nome já existe lá) cai para /instance/connect', async () => {
      const fetchSpy = mockFetch(
        listed(),
        { ok: false, status: 403, body: { message: 'already in use' } },
        { ok: true, body: { qrcode: { base64: QR } } },
      );

      const session = await provider().connect();

      expect(fetchSpy.mock.calls[2][0]).toContain('/instance/connect/');
      expect(session.qrCode).toBe(QR);
    });

    describe('status', () => {
      it.each([
        ['open', 'CONNECTED'],
        ['connecting', 'CONNECTING'],
        ['close', 'DISCONNECTED'],
      ])('mapeia %s → %s', async (state, expected) => {
        mockFetch(listed(row(state)));
        expect((await provider().status()).status).toBe(expected);
      });

      // O ponto da mudança: "nunca criada" e "criada e desconectada" são situações diferentes.
      it('instância que não existe é NOT_CREATED, distinta de DISCONNECTED', async () => {
        mockFetch(listed());
        expect(await provider().status()).toEqual({ status: 'NOT_CREATED' });
      });

      it('só conta a instância com o NOSSO nome, mesmo que a Evolution ignore o filtro', async () => {
        mockFetch(listed({ name: 'de-outro-uso', connectionStatus: 'open' }));
        expect((await provider().status()).status).toBe('NOT_CREATED');
      });

      it('devolve o número pareado (ownerJid) normalizado', async () => {
        mockFetch(
          listed(row('open', { ownerJid: '553499895646@s.whatsapp.net' })),
        );
        expect(await provider().status()).toMatchObject({
          status: 'CONNECTED',
          phoneNumber: expect.stringMatching(/^5534/),
        });
      });

      it('aceita o formato antigo da v2 (instance.instanceName/status)', async () => {
        mockFetch(
          listed({
            instance: { instanceName: 'minha-instancia', status: 'open' },
          }),
        );
        expect((await provider().status()).status).toBe('CONNECTED');
      });

      it('sem fetchInstances útil, cai para connectionState; 404 = NOT_CREATED', async () => {
        const fetchSpy = mockFetch(
          { ok: false, status: 500 },
          { ok: false, status: 404 },
        );
        expect(await provider().status()).toEqual({ status: 'NOT_CREATED' });
        expect(fetchSpy.mock.calls[1][0]).toContain(
          '/instance/connectionState/minha-instancia',
        );
      });

      it('fallback com connectionState legível mapeia o estado', async () => {
        mockFetch(
          { ok: true, body: { instance: { state: 'open' } } },
          { ok: true, body: { instance: { state: 'open' } } },
        );
        expect((await provider().status()).status).toBe('CONNECTED');
      });
    });

    it('disconnect chama logout e devolve ProviderResult', async () => {
      const fetchSpy = mockFetch({ ok: true, body: {} });
      const res = await provider().disconnect();

      const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('http://evo:8080/instance/logout/minha-instancia');
      expect(init.method).toBe('DELETE');
      expect(res.status).toBe(true);
    });
  });

  describe('Evolution API — registrar o webhook liga o sistema à instância', () => {
    const register = () =>
      new EvolutionApiProvider()
        .use(cfg)
        .registerWebhook('https://app/api/messaging/webhook?key=k');
    const none = { ok: true, body: [] };

    it('instância inexistente é CRIADA antes de registrar o webhook', async () => {
      const fetchSpy = mockFetch(
        none,
        { ok: true, body: {} },
        { ok: true, body: {} },
      );

      const res = await register();

      expect(res.status).toBe(true);
      expect(fetchSpy.mock.calls.map((c) => c[0])).toEqual([
        'http://evo:8080/instance/fetchInstances?instanceName=minha-instancia',
        'http://evo:8080/instance/create',
        'http://evo:8080/webhook/set/minha-instancia',
      ]);
    });

    it('instância já existente não é recriada', async () => {
      const fetchSpy = mockFetch(
        {
          ok: true,
          body: [{ name: 'minha-instancia', connectionStatus: 'open' }],
        },
        { ok: true, body: {} },
      );
      await register();
      expect(fetchSpy.mock.calls.map((c) => c[0])).toEqual([
        'http://evo:8080/instance/fetchInstances?instanceName=minha-instancia',
        'http://evo:8080/webhook/set/minha-instancia',
      ]);
    });

    it('assina conexão e QR além das mensagens — é o que dispensa o polling', async () => {
      const fetchSpy = mockFetch(
        {
          ok: true,
          body: [{ name: 'minha-instancia', connectionStatus: 'close' }],
        },
        { ok: true, body: {} },
      );
      await register();
      const webhook = JSON.parse(
        (fetchSpy.mock.calls[1][1] as RequestInit).body as string,
      ).webhook;
      expect(webhook.events).toEqual(
        expect.arrayContaining([
          'MESSAGES_UPSERT',
          'MESSAGES_UPDATE',
          'CONNECTION_UPDATE',
          'QRCODE_UPDATED',
        ]),
      );
      expect(webhook.base64).toBe(false);
    });

    it('create recusado devolve a causa em vez de seguir sem instância', async () => {
      mockFetch(none, {
        ok: false,
        status: 401,
        body: { message: 'apikey inválida' },
      });
      const res = await register();
      expect(res.status).toBe(false);
      expect(res.data).toContain('apikey inválida');
    });
  });

  describe('Evolution API — eventos de conexão por webhook', () => {
    const parse = (body: unknown) =>
      new EvolutionApiProvider().use(cfg).parseWebhook(body);

    it.each([
      ['open', 'CONNECTED'],
      ['connecting', 'CONNECTING'],
      ['close', 'DISCONNECTED'],
    ])('connection.update %s → %s', (state, status) => {
      expect(
        parse({
          event: 'connection.update',
          instance: 'minha-instancia',
          data: { state },
        }),
      ).toEqual([{ kind: 'CONNECTION', status }]);
    });

    it('qrcode.updated traz o QR e o código de pareamento', () => {
      expect(
        parse({
          event: 'qrcode.updated',
          instance: 'minha-instancia',
          data: { qrcode: { base64: QR, pairingCode: 'XYZ' } },
        }),
      ).toEqual([
        {
          kind: 'CONNECTION',
          status: 'CONNECTING',
          qrCode: QR,
          pairingCode: 'XYZ',
        },
      ]);
    });

    it('qrcode.updated sem imagem não vira evento', () => {
      expect(parse({ event: 'qrcode.updated', data: { qrcode: {} } })).toEqual(
        [],
      );
    });

    // O mesmo webhook pode receber eventos de todas as instâncias da Evolution.
    it('evento de OUTRA instância é descartado — conexão e mensagem', () => {
      expect(
        parse({
          event: 'connection.update',
          instance: 'de-outro-uso',
          data: { state: 'close' },
        }),
      ).toEqual([]);
      expect(
        parse({
          event: 'messages.upsert',
          instance: 'de-outro-uso',
          data: {
            key: {
              id: 'A',
              remoteJid: '5511999999999@s.whatsapp.net',
              fromMe: false,
            },
            message: { conversation: 'oi' },
          },
        }),
      ).toEqual([]);
    });

    it('payload sem o campo instance continua aceito (versões que não o enviam)', () => {
      expect(
        parse({ event: 'connection.update', data: { state: 'open' } }),
      ).toHaveLength(1);
    });
  });
});
