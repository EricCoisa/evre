import { EvolutionApiProvider } from './evolution-api.provider';
import { EvolutionGoProvider } from './evolution-go.provider';
import { MetaProvider } from './meta.provider';
import { createHmac } from 'crypto';
import { GO_PLAIN_CONFIG } from '../test-utils/messaging-fixtures';

const evoCfg = {
  baseUrl: 'http://evo',
  token: 't',
  instance: 'i',
  webhookSecret: 'segredo-evo',
};
const goCfg = { ...GO_PLAIN_CONFIG, instanceToken: 'tok-go' };
const metaCfg = {
  phoneNumberId: '1',
  accessToken: 'a',
  appSecret: 'app-secret',
  verifyToken: 'verify-me',
  graphVersion: 'v21.0',
  wabaId: 'waba-1',
};

const req = (body: unknown, headers: Record<string, string> = {}) => ({
  raw: Buffer.from(JSON.stringify(body), 'utf8'),
  headers,
  query: {},
});

describe('webhook — Evolution API (Node)', () => {
  const provider = new EvolutionApiProvider().use(evoCfg);

  it('aceita o Bearer que registramos e recusa o errado', () => {
    expect(
      provider.verifyWebhook(req({}, { authorization: 'Bearer segredo-evo' })),
    ).toBe(true);
    expect(
      provider.verifyWebhook(req({}, { authorization: 'Bearer outro' })),
    ).toBe(false);
    expect(provider.verifyWebhook(req({}, {}))).toBe(false);
  });

  it('normaliza inbound de messages.upsert', async () => {
    const [event] = await provider.parseWebhook({
      event: 'messages.upsert',
      data: {
        key: {
          remoteJid: '551187654321@s.whatsapp.net',
          fromMe: false,
          id: '3EB0',
        },
        pushName: 'Fulano',
        message: { conversation: 'oi' },
        messageTimestamp: 1728000000,
      },
    });

    expect(event).toMatchObject({
      kind: 'MESSAGE',
      providerMessageId: '3EB0',
      phone: '5511987654321', // 9º dígito canonizado
      pushName: 'Fulano',
      text: 'oi',
    });
  });

  it('lê texto de extendedTextMessage (resposta/citação)', async () => {
    const [event] = await provider.parseWebhook({
      event: 'messages.upsert',
      data: {
        key: {
          remoteJid: '5511999999999@s.whatsapp.net',
          fromMe: false,
          id: 'X',
        },
        message: { extendedTextMessage: { text: 'citando' } },
      },
    });
    expect(event).toMatchObject({ kind: 'MESSAGE', text: 'citando' });
  });

  // fromMe chega marcado: o facade grava como OUTBOUND (mensagem enviada pelo celular) e o
  // upsert por providerMessageId evita duplicar o que enviamos por aqui.
  it('marca fromMe em vez de descartar', async () => {
    const [event] = await provider.parseWebhook({
      event: 'messages.upsert',
      data: {
        key: {
          remoteJid: '5511999999999@s.whatsapp.net',
          fromMe: true,
          id: 'X',
        },
        pushName: 'Eu',
        message: { conversation: 'enviei pelo celular' },
      },
    });
    expect(event).toMatchObject({ fromMe: true, text: 'enviei pelo celular' });
    expect(event).not.toHaveProperty('pushName', 'Eu');
  });

  it('descarta grupo', async () => {
    expect(
      await provider.parseWebhook({
        event: 'messages.upsert',
        data: { key: { remoteJid: '123456@g.us', fromMe: false, id: 'X' } },
      }),
    ).toEqual([]);
  });

  it('mapeia status conhecido e ignora desconhecido', async () => {
    const [read] = await provider.parseWebhook({
      event: 'messages.update',
      data: { key: { id: 'A' }, status: 'READ' },
    });
    expect(read).toMatchObject({
      kind: 'STATUS',
      providerMessageId: 'A',
      status: 'READ',
    });

    expect(
      await provider.parseWebhook({
        event: 'messages.update',
        data: { key: { id: 'A' }, status: 'ALGO_NOVO' },
      }),
    ).toEqual([]);
  });

  it('evento não suportado devolve lista vazia, não erro', async () => {
    expect(
      await provider.parseWebhook({ event: 'connection.update', data: {} }),
    ).toEqual([]);
    expect(await provider.parseWebhook(null)).toEqual([]);
  });

  describe('presence.update (Baileys)', () => {
    const presence = (lastKnownPresence: string, id = '5511987654321@s.whatsapp.net') =>
      provider.parseWebhook({
        event: 'presence.update',
        data: { id, presences: { [id]: { lastKnownPresence } } },
      });

    it('composing vira COMPOSING', async () => {
      expect(await presence('composing')).toEqual([
        { kind: 'PRESENCE', phone: '5511987654321', state: 'COMPOSING' },
      ]);
    });

    it('recording vira RECORDING (nota de voz)', async () => {
      expect(await presence('recording')).toMatchObject([{ state: 'RECORDING' }]);
    });

    it('paused vira PAUSED', async () => {
      expect(await presence('paused')).toMatchObject([{ state: 'PAUSED' }]);
    });

    it('available/unavailable (online, não digitando) não vira evento', async () => {
      expect(await presence('available')).toEqual([]);
      expect(await presence('unavailable')).toEqual([]);
    });

    it('grupo (@g.us) é descartado', async () => {
      expect(await presence('composing', '123456-789@g.us')).toEqual([]);
    });
  });
});

describe('webhook — Meta', () => {
  const provider = new MetaProvider().use(metaCfg);

  it('valida HMAC sobre o corpo CRU', () => {
    const body = { entry: [] };
    const raw = Buffer.from(JSON.stringify(body), 'utf8');
    const sig =
      'sha256=' + createHmac('sha256', 'app-secret').update(raw).digest('hex');

    expect(
      provider.verifyWebhook({
        raw,
        headers: { 'x-hub-signature-256': sig },
        query: {},
      }),
    ).toBe(true);
    expect(
      provider.verifyWebhook({
        raw,
        headers: { 'x-hub-signature-256': 'sha256=deadbeef' },
        query: {},
      }),
    ).toBe(false);
  });

  // Prova que reserializar o JSON quebraria a assinatura — motivo de o proxy usar req.text().
  it('assinatura do corpo reserializado NÃO valida', () => {
    const body = { entry: [], a: 1 };
    const original = Buffer.from(JSON.stringify(body), 'utf8');
    const sig =
      'sha256=' +
      createHmac('sha256', 'app-secret').update(original).digest('hex');
    const reserialized = Buffer.from(
      JSON.stringify(JSON.parse(original.toString())) + ' ',
      'utf8',
    );

    expect(
      provider.verifyWebhook({
        raw: reserialized,
        headers: { 'x-hub-signature-256': sig },
        query: {},
      }),
    ).toBe(false);
  });

  it('normaliza mensagem e status do envelope entry/changes', async () => {
    const events = await provider.parseWebhook({
      entry: [
        {
          changes: [
            {
              value: {
                contacts: [
                  { wa_id: '5511987654321', profile: { name: 'Fulano' } },
                ],
                messages: [
                  {
                    id: 'wamid.A',
                    from: '5511987654321',
                    type: 'text',
                    timestamp: '1728000000',
                    text: { body: 'oi' },
                  },
                ],
                statuses: [
                  {
                    id: 'wamid.B',
                    status: 'delivered',
                    timestamp: '1728000001',
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      kind: 'MESSAGE',
      providerMessageId: 'wamid.A',
      pushName: 'Fulano',
      text: 'oi',
    });
    expect(events[1]).toMatchObject({
      kind: 'STATUS',
      providerMessageId: 'wamid.B',
      status: 'DELIVERED',
    });
  });

  it('handshake devolve o challenge só com o verify_token certo', () => {
    const meta = new MetaProvider().use(metaCfg);
    expect(
      meta.verifyChallenge!({
        'hub.mode': 'subscribe',
        'hub.verify_token': 'verify-me',
        'hub.challenge': '12345',
      }),
    ).toBe('12345');
    expect(
      meta.verifyChallenge!({
        'hub.mode': 'subscribe',
        'hub.verify_token': 'errado',
        'hub.challenge': '12345',
      }),
    ).toBeNull();
  });
});

describe('webhook — Evolution Go', () => {
  const provider = new EvolutionGoProvider().use(goCfg);

  it('confere instanceToken no corpo', () => {
    expect(provider.verifyWebhook(req({ instanceToken: 'tok-go' }))).toBe(true);
    expect(provider.verifyWebhook(req({ instanceToken: 'outro' }))).toBe(false);
    expect(
      provider.verifyWebhook({
        raw: Buffer.from('nao é json'),
        headers: {},
        query: {},
      }),
    ).toBe(false);
  });

  it('normaliza evento Message e marca IsFromMe', async () => {
    const [event] = await provider.parseWebhook({
      event: 'Message',
      data: {
        Info: {
          Chat: '551187654321@s.whatsapp.net',
          ID: '3EB0',
          IsFromMe: false,
          Timestamp: '2024-10-10T17:17:44-03:00',
        },
        Message: { conversation: 'oi' },
      },
    });
    expect(event).toMatchObject({
      kind: 'MESSAGE',
      providerMessageId: '3EB0',
      phone: '5511987654321',
      text: 'oi',
      fromMe: false,
    });

    const [mine] = await provider.parseWebhook({
      event: 'Message',
      data: {
        Info: { Chat: '5511999999999@s.whatsapp.net', ID: 'X', IsFromMe: true },
        Message: { conversation: 'do celular' },
      },
    });
    expect(mine).toMatchObject({ fromMe: true, text: 'do celular' });
  });

  // MessageIDs é array: um Receipt atualiza N mensagens de uma vez.
  it('Receipt com N ids vira N eventos de status', async () => {
    const events = await provider.parseWebhook({
      event: 'Receipt',
      data: {
        MessageIDs: ['A', 'B'],
        Type: 'read',
        Timestamp: '2024-10-10T17:18:00-03:00',
      },
    });
    expect(events).toHaveLength(2);
    expect(
      events.map((e) => (e.kind === 'STATUS' ? e.providerMessageId : '')),
    ).toEqual(['A', 'B']);
    expect(
      events.every((e) => e.kind === 'STATUS' && e.status === 'READ'),
    ).toBe(true);
  });

  /** Confere que o estado do Receipt vem do `state` do envelope, e não de `data.Type`. */
  describe('Receipt — o estado vem do envelope', () => {
    const receipt = (state: string, Type = '') =>
      provider.parseWebhook({
        event: 'Receipt',
        state,
        data: { MessageIDs: ['A'], Type, Timestamp: '2024-10-10T17:18:00-03:00' },
      });
    const statusOf = (events: Awaited<ReturnType<typeof receipt>>) =>
      events[0]?.kind === 'STATUS' ? events[0].status : undefined;

    it('Delivered vira DELIVERED mesmo com data.Type vazio', async () => {
      expect(statusOf(await receipt('Delivered'))).toBe('DELIVERED');
    });

    it('Read vira READ', async () => {
      expect(statusOf(await receipt('Read', 'read'))).toBe('READ');
    });

    /** Leitura da nossa própria conta em outro aparelho: a mensagem foi lida. */
    it('ReadSelf vira READ', async () => {
      expect(statusOf(await receipt('ReadSelf', 'read-self'))).toBe('READ');
    });

    it('state desconhecido e sem Type não vira evento', async () => {
      expect(await receipt('Retry', 'retry')).toEqual([]);
    });
  });

  describe('ChatPresence (whatsmeow)', () => {
    const chatPresence = (State: string, Media = '', over: Record<string, unknown> = {}) =>
      provider.parseWebhook({
        event: 'ChatPresence',
        data: { Chat: '551187654321@s.whatsapp.net', State, Media, ...over },
      });

    it('composing sem Media vira COMPOSING', async () => {
      expect(await chatPresence('composing')).toEqual([
        { kind: 'PRESENCE', phone: '5511987654321', state: 'COMPOSING' },
      ]);
    });

    it('composing com Media=audio vira RECORDING (gravando nota de voz)', async () => {
      expect(await chatPresence('composing', 'audio')).toMatchObject([
        { state: 'RECORDING' },
      ]);
    });

    it('paused vira PAUSED', async () => {
      expect(await chatPresence('paused')).toMatchObject([{ state: 'PAUSED' }]);
    });

    it('IsGroup descarta, mesmo com Chat de telefone', async () => {
      expect(await chatPresence('composing', '', { IsGroup: true })).toEqual([]);
    });

    it('state desconhecido não vira evento', async () => {
      expect(await chatPresence('algumacoisa')).toEqual([]);
    });
  });
});

describe('webhook — mensagens que não são de uma pessoa com telefone', () => {
  const evo = new EvolutionApiProvider().use(evoCfg);
  const go = new EvolutionGoProvider().use(goCfg);

  const upsert = (key: Record<string, unknown>) => ({
    event: 'messages.upsert',
    data: {
      key: { id: 'M1', fromMe: false, ...key },
      message: { conversation: 'oi' },
    },
  });
  const goMessage = (info: Record<string, unknown>) => ({
    event: 'Message',
    data: {
      Info: { ID: 'M1', IsFromMe: false, ...info },
      Message: { conversation: 'oi' },
    },
  });

  it('status do WhatsApp (status@broadcast) não vira contato', () => {
    expect(
      evo.parseWebhook(
        upsert({
          remoteJid: 'status@broadcast',
          participant: '5511@s.whatsapp.net',
        }),
      ),
    ).toEqual([]);
    expect(go.parseWebhook(goMessage({ Chat: 'status@broadcast' }))).toEqual(
      [],
    );
  });

  it('@lid sem JID de telefone é descartado — não há número a usar', () => {
    expect(evo.parseWebhook(upsert({ remoteJid: '999@lid' }))).toEqual([]);
    expect(go.parseWebhook(goMessage({ Chat: '999@lid' }))).toEqual([]);
  });

  /** `IsGroup` vem do whatsmeow: é a fonte certa, não o sufixo do JID. */
  it('Evolution Go descarta grupo por IsGroup, não só pelo sufixo do JID', () => {
    expect(
      go.parseWebhook(
        goMessage({
          Chat: '5534998956461@s.whatsapp.net',
          IsGroup: true,
          SenderAlt: '5511918798714@s.whatsapp.net',
        }),
      ),
    ).toEqual([]);
  });

  it('@lid com o JID de telefone ao lado usa o telefone, não o id opaco', () => {
    const [evoEvent] = evo.parseWebhook(
      upsert({
        remoteJid: '999@lid',
        remoteJidAlt: '5534998956461@s.whatsapp.net',
      }),
    ) as Array<{ phone: string }>;
    expect(evoEvent.phone).toBe('5534998956461');

    const [goEvent] = go.parseWebhook(
      goMessage({ Chat: '999@lid', SenderAlt: '5534998956461@s.whatsapp.net' }),
    ) as Array<{ phone: string }>;
    expect(goEvent.phone).toBe('5534998956461');
  });
});

describe('webhook — Evolution Go: eventos de conexão', () => {
  const go = new EvolutionGoProvider().use(goCfg);
  const ev = (event: string, data: Record<string, unknown>) =>
    go.parseWebhook({ event, data });

  it('Connected e PairSuccess trazem o número do JID do aparelho (sem o :device)', () => {
    expect(
      ev('Connected', {
        status: 'open',
        jid: '5511918798714:5@s.whatsapp.net',
      }),
    ).toEqual([
      { kind: 'CONNECTION', status: 'CONNECTED', phoneNumber: '5511918798714' },
    ]);
    expect(ev('PairSuccess', { ID: '5511918798714:5@s.whatsapp.net' })).toEqual(
      [
        {
          kind: 'CONNECTION',
          status: 'CONNECTED',
          phoneNumber: '5511918798714',
        },
      ],
    );
  });

  it('LoggedOut desconecta; QRCode entrega a imagem', () => {
    expect(ev('LoggedOut', { Reason: 'logged_out' })).toEqual([
      { kind: 'CONNECTION', status: 'DISCONNECTED' },
    ]);
    expect(
      ev('QRCode', { code: '2@x', qrcode: 'data:image/png;base64,AAAA' }),
    ).toEqual([
      {
        kind: 'CONNECTION',
        status: 'CONNECTING',
        qrCode: 'data:image/png;base64,AAAA',
      },
    ]);
  });

  /** Confere o tratamento de todos os eventos que o Go emite no grupo CONNECTION. */
  it.each([
    ['Disconnected', { Reason: 'socket' }],
    ['ConnectFailure', { Reason: 'failure' }],
    ['TemporaryBan', { Code: 1 }],
    ['QRTimeout', {}],
  ])('%s desconecta', (event, data) => {
    expect(ev(event, data)).toEqual([
      { kind: 'CONNECTION', status: 'DISCONNECTED' },
    ]);
  });

  /** QR lido: sai do "aguardando leitura". Quem fixa o número é o PairSuccess/Connected seguinte. */
  it('QRSuccess segue CONNECTING, sem número', () => {
    expect(ev('QRSuccess', {})).toEqual([
      { kind: 'CONNECTION', status: 'CONNECTING' },
    ]);
  });

  it('eventos que não interessam são ignorados', () => {
    expect(ev('OfflineSyncCompleted', { Count: 4 })).toEqual([]);
  });
});
