import { ConflictException } from '@nestjs/common';
import { MessagingConnectionStateService } from './messaging-connection-state.service';
import { MessagingSessionStore } from './messaging-session.store';
import {
  EVO,
  GO_CONNECTION,
  META,
  realConnections,
  type ConnectionRow,
} from './test-utils/messaging-fixtures';

const PHONE = '5534998956461';
const OTHER = '5511911112222';

function setup(rows: ConnectionRow[] = [EVO]) {
  const { service: connections, registry } = realConnections(rows);
  const kv = new Map<string, string>();
  const redis = {
    get: vi.fn((k: string) => Promise.resolve(kv.get(k) ?? null)),
    set: vi.fn((k: string, v: string) => {
      kv.set(k, v);
      return Promise.resolve();
    }),
    del: vi.fn((k: string) => {
      kv.delete(k);
      return Promise.resolve();
    }),
  };
  const events = { emit: vi.fn() };
  const state = new MessagingConnectionStateService(
    connections,
    registry,
    new MessagingSessionStore(redis as never),
    redis as never,
    events as never,
    {
      t: (key: string, opts?: { args?: { phone?: string } }) =>
        opts?.args?.phone ? `${key}:${opts.args.phone}` : key,
    } as never,
  );
  return { state, connections, kv, redis, events };
}

const res = (body: unknown, ok = true, status = 200) => ({
  ok,
  status,
  statusText: 'x',
  json: () => Promise.resolve(body),
});
const listed = (connectionStatus: string, ownerJid?: string) =>
  res([{ name: 'inst', connectionStatus, ...(ownerJid ? { ownerJid } : {}) }]);

/** Responde por URL: a ordem das chamadas não é o que importa nestes testes. */
function route(handlers: Array<[RegExp, () => unknown]>) {
  const spy = vi.fn((url: string) => {
    const hit = handlers.find(([pattern]) => pattern.test(url));
    return Promise.resolve(hit ? hit[1]() : res({}));
  });
  vi.stubGlobal('fetch', spy);
  return spy;
}
const stored = (kv: Map<string, string>, id = 'conn-evo') =>
  JSON.parse(kv.get(`messaging:session:${id}`)!);

describe('MessagingConnectionStateService', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('estado por conexão (sem polling do provider)', () => {
    it('status fresco vem do Redis SEM chamar o provider; cada conexão tem o seu', async () => {
      const { state, kv } = setup();
      kv.set(
        'messaging:session:conn-evo',
        JSON.stringify({ status: 'CONNECTED', updatedAt: Date.now() }),
      );
      const fetchSpy = vi.fn();
      vi.stubGlobal('fetch', fetchSpy);

      expect(await state.status(EVO as never)).toMatchObject({
        supported: true,
        status: 'CONNECTED',
      });
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('estado envelhecido (webhook perdido) é conferido no provider e regravado', async () => {
      const { state, kv } = setup();
      kv.set(
        'messaging:session:conn-evo',
        JSON.stringify({
          status: 'CONNECTED',
          updatedAt: Date.now() - 10 * 60_000,
        }),
      );
      route([[/fetchInstances/, () => listed('close')]]);

      expect(await state.status(EVO as never)).toMatchObject({
        status: 'DISCONNECTED',
      });
      expect(stored(kv).status).toBe('DISCONNECTED');
    });

    it('instância apagada no provider aparece como NOT_CREATED', async () => {
      const { state } = setup();
      route([[/fetchInstances/, () => res([])]]);
      expect((await state.status(EVO as never)).status).toBe('NOT_CREATED');
    });

    it('Meta não tem sessão: supported:false', async () => {
      const { state } = setup([META]);
      expect(await state.status(META as never)).toEqual({
        supported: false,
        status: 'CONNECTED',
      });
    });

    it('connection.update grava o estado, derruba o health e avisa a tela', async () => {
      const { state, kv, redis, events } = setup();
      await state.applyEvent(EVO as never, {
        kind: 'CONNECTION',
        status: 'DISCONNECTED',
      });

      expect(stored(kv)).toMatchObject({ status: 'DISCONNECTED' });
      expect(redis.del).toHaveBeenCalledWith('messaging:health:conn-evo');
      expect(events.emit).toHaveBeenCalledWith({ type: 'connection' });
    });

    it('QR novo por webhook chega ao status', async () => {
      const { state } = setup();
      await state.applyEvent(EVO as never, {
        kind: 'CONNECTION',
        status: 'CONNECTING',
        qrCode: 'data:QR',
        pairingCode: 'PC',
      });
      expect(await state.status(EVO as never)).toMatchObject({
        status: 'CONNECTING',
        qrCode: 'data:QR',
        pairingCode: 'PC',
      });
    });

    it('reset limpa estado e health só desta conexão', async () => {
      const { state, kv } = setup();
      kv.set(
        'messaging:session:conn-evo',
        JSON.stringify({ status: 'CONNECTED', updatedAt: Date.now() }),
      );
      kv.set(
        'messaging:session:outra',
        JSON.stringify({ status: 'CONNECTED', updatedAt: Date.now() }),
      );
      await state.reset('conn-evo');
      expect(kv.has('messaging:session:conn-evo')).toBe(false);
      expect(kv.has('messaging:session:outra')).toBe(true);
    });
  });

  describe('capabilities', () => {
    it('vêm do provider da conexão e identificam a conexão', () => {
      const { state } = setup();
      expect(state.capabilities(EVO as never)).toMatchObject({
        provider: 'EVOLUTION_API',
        connectionId: 'conn-evo',
        voiceRecording: true,
        template: { approval: false },
      });
      expect(state.capabilities(META as never)).toMatchObject({
        provider: 'META',
        voiceRecording: false,
        template: { approval: true },
      });
    });
  });

  describe('health por conexão', () => {
    const validate = (s: string) =>
      [/connectionState/, () => res({ instance: { state: s } })] as [
        RegExp,
        () => unknown,
      ];

    it('credencial válida COM sessão caída não é operacional, e diz como resolver', async () => {
      const { state, kv } = setup();
      kv.set(
        'messaging:session:conn-evo',
        JSON.stringify({ status: 'DISCONNECTED', updatedAt: Date.now() }),
      );
      route([validate('close')]);
      expect(await state.health(EVO as never)).toEqual({
        operational: false,
        reason: 'messaging.session_DISCONNECTED',
      });
    });

    it('instância ainda não criada tem motivo próprio', async () => {
      const { state, kv } = setup();
      kv.set(
        'messaging:session:conn-evo',
        JSON.stringify({ status: 'NOT_CREATED', updatedAt: Date.now() }),
      );
      route([validate('close')]);
      expect((await state.health(EVO as never)).reason).toContain(
        'messaging.session_NOT_CREATED',
      );
    });

    it('sessão conectada é operacional', async () => {
      const { state, kv } = setup();
      kv.set(
        'messaging:session:conn-evo',
        JSON.stringify({ status: 'CONNECTED', updatedAt: Date.now() }),
      );
      route([validate('open')]);
      expect(await state.health(EVO as never)).toEqual({ operational: true });
    });

    it('credencial inválida prevalece sobre o estado da sessão', async () => {
      const { state, kv } = setup();
      kv.set(
        'messaging:session:conn-evo',
        JSON.stringify({ status: 'CONNECTED', updatedAt: Date.now() }),
      );
      route([
        [/connectionState/, () => res({ message: 'Unauthorized' }, false, 401)],
      ]);
      expect(await state.health(EVO as never)).toMatchObject({
        operational: false,
        reason: 'Unauthorized',
      });
    });

    it('config inválida vira operational:false com motivo, não exceção', async () => {
      const { state } = setup([{ ...EVO, config: {} }]);
      const result = await state.health({ ...EVO, config: {} } as never);
      expect(result.operational).toBe(false);
      expect(result.reason).toMatch(/baseUrl|token|instance/);
    });

    it('hit no cache não toca no provider; o cache é por conexão e dura 300s', async () => {
      const { state, kv, redis } = setup();
      kv.set('messaging:health:conn-evo', '{"operational":true}');
      const fetchSpy = vi.fn();
      vi.stubGlobal('fetch', fetchSpy);
      expect(await state.health(EVO as never)).toEqual({ operational: true });
      expect(fetchSpy).not.toHaveBeenCalled();

      kv.clear();
      kv.set(
        'messaging:session:conn-evo',
        JSON.stringify({ status: 'CONNECTED', updatedAt: Date.now() }),
      );
      route([validate('open')]);
      await state.health(EVO as never);
      expect(redis.set).toHaveBeenCalledWith(
        'messaging:health:conn-evo',
        expect.any(String),
        300,
      );
    });

    it('Meta depende só da credencial — e fixa o número da conta na primeira checagem', async () => {
      const { state, connections } = setup([META]);
      const bind = vi
        .spyOn(connections, 'bindPhone')
        .mockResolvedValue({} as never);
      route([
        [/fields=verified_name/, () => res({ verified_name: 'X' })],
        [
          /fields=display_phone_number/,
          () => res({ display_phone_number: '+55 34 99895-6461' }),
        ],
      ]);

      expect(await state.health(META as never)).toEqual({ operational: true });
      expect(bind).toHaveBeenCalledWith('conn-meta', PHONE);
    });

    it('Meta: accountPhone fora do ar não derruba a checagem de saúde, só fica sem o número', async () => {
      const { state, connections } = setup([META]);
      const bind = vi.spyOn(connections, 'bindPhone');
      route([
        [/fields=verified_name/, () => res({ verified_name: 'X' })],
        [/fields=display_phone_number/, () => Promise.reject(new Error('conta indisponível'))],
      ]);

      expect(await state.health(META as never)).toEqual({ operational: true });
      expect(bind).not.toHaveBeenCalled();
    });

    it('Meta com número já fixado não consulta de novo', async () => {
      const { state, connections } = setup([META]);
      const bind = vi.spyOn(connections, 'bindPhone');
      const fetchSpy = route([[/./, () => res({ verified_name: 'X' })]]);
      await state.health({ ...META, phone: PHONE } as never);
      expect(bind).not.toHaveBeenCalled();
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    // `connected: false` ainda aprova a CREDENCIAL (chave global válida); sem exigir a sessão
    // conectada, a conexão era dada como operacional com o WhatsApp deslogado.
    it('Evolution Go deslogado NÃO é operacional, mesmo com a credencial boa', async () => {
      const { state } = setup([GO_CONNECTION]);
      route([[/./, () => res({ data: { connected: false } })]]);

      expect(await state.health(GO_CONNECTION as never)).toMatchObject({
        operational: false,
      });
    });

    it('Evolution Go conectado é operacional', async () => {
      const { state } = setup([GO_CONNECTION]);
      route([
        [/./, () => res({ data: { connected: true, jid: '5511918798714@s.whatsapp.net' } })],
      ]);

      expect(await state.health(GO_CONNECTION as never)).toEqual({ operational: true });
    });

    it('conexão arquivada devolve o motivo sem chamar o provider', async () => {
      const { state } = setup();
      const fetchSpy = vi.fn();
      vi.stubGlobal('fetch', fetchSpy);

      expect(
        await state.health({ ...EVO, archivedAt: new Date() } as never),
      ).toEqual({
        operational: false,
        reason: 'messaging.connection_archived',
      });
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe('checkAnyOperational', () => {
    it('sem conexão nenhuma, falha com o motivo "sem conexão"', async () => {
      const { state } = setup([]);

      await expect(state.checkAnyOperational()).resolves.toEqual({
        operational: false,
        reason: 'messaging.no_connection',
      });
    });

    it('pelo menos uma operacional é suficiente', async () => {
      const { state, kv } = setup([EVO]);
      kv.set('messaging:health:conn-evo', JSON.stringify({ operational: true }));

      await expect(state.checkAnyOperational()).resolves.toEqual({
        operational: true,
      });
    });

    it('nenhuma operacional: falha com o motivo da última checada', async () => {
      const { state, kv } = setup([EVO]);
      kv.set(
        'messaging:health:conn-evo',
        JSON.stringify({ operational: false, reason: 'motivo x' }),
      );

      await expect(state.checkAnyOperational()).resolves.toEqual({
        operational: false,
        reason: 'motivo x',
      });
    });
  });

  describe('a regra do número (reconectar só com o mesmo número)', () => {
    it('primeiro pareamento: o número da sessão vira o número da conexão', async () => {
      const { state, connections, kv } = setup();
      const bind = vi
        .spyOn(connections, 'bindPhone')
        .mockResolvedValue({} as never);
      kv.set(
        'messaging:session:conn-evo',
        JSON.stringify({
          status: 'CONNECTED',
          updatedAt: Date.now() - 10 * 60_000,
        }),
      );
      route([
        [/fetchInstances/, () => listed('open', '553498956461@s.whatsapp.net')],
      ]);

      const session = await state.status(EVO as never);

      expect(bind).toHaveBeenCalledWith('conn-evo', PHONE); // 9º dígito canonizado
      expect(session).toMatchObject({
        status: 'CONNECTED',
        phoneNumber: expect.stringMatching(/^5534/),
      });
    });

    it('reconectar com o MESMO número passa', async () => {
      const { state, connections, kv } = setup();
      const bind = vi.spyOn(connections, 'bindPhone');
      kv.set(
        'messaging:session:conn-evo',
        JSON.stringify({
          status: 'DISCONNECTED',
          updatedAt: Date.now() - 10 * 60_000,
        }),
      );
      const spy = route([
        [/fetchInstances/, () => listed('open', `${PHONE}@s.whatsapp.net`)],
      ]);

      const session = await state.status({ ...EVO, phone: PHONE } as never);

      expect(session.status).toBe('CONNECTED');
      expect(bind).not.toHaveBeenCalled();
      expect(spy.mock.calls.some(([url]) => /logout/.test(url as string))).toBe(
        false,
      );
    });

    it('QR de OUTRO número: a sessão é desfeita no provider e o motivo fica registrado', async () => {
      const { state, kv } = setup();
      kv.set(
        'messaging:session:conn-evo',
        JSON.stringify({
          status: 'CONNECTING',
          updatedAt: Date.now() - 10 * 60_000,
        }),
      );
      const spy = route([
        [/fetchInstances/, () => listed('open', `${OTHER}@s.whatsapp.net`)],
      ]);

      const session = await state.status({ ...EVO, phone: PHONE } as never);

      expect(session).toEqual({
        supported: true,
        status: 'DISCONNECTED',
        error: 'PHONE_MISMATCH',
        expectedPhone: PHONE,
      });
      // Logout no provider: a sessão do número errado não pode ficar de pé.
      const logout = (
        spy.mock.calls as unknown as Array<[string, RequestInit]>
      ).find(([url]) => /logout/.test(url));
      expect(logout).toBeTruthy();
      expect(logout![1].method).toBe('DELETE');
      expect(stored(kv)).toMatchObject({
        error: 'PHONE_MISMATCH',
        expectedPhone: PHONE,
      });
    });

    it('o health explica o número esperado', async () => {
      const { state, kv } = setup();
      kv.set(
        'messaging:session:conn-evo',
        JSON.stringify({
          status: 'DISCONNECTED',
          error: 'PHONE_MISMATCH',
          expectedPhone: PHONE,
          updatedAt: Date.now(),
        }),
      );
      route([[/connectionState/, () => res({ instance: { state: 'close' } })]]);
      const health = await state.health({ ...EVO, phone: PHONE } as never);
      expect(health.reason).toBe(`messaging.session_PHONE_MISMATCH:${PHONE}`);
    });

    it('número que já é de outra conexão: sessão desfeita com PHONE_IN_USE', async () => {
      const { state, connections, kv } = setup();
      vi.spyOn(connections, 'bindPhone').mockRejectedValue(
        new ConflictException(),
      );
      kv.set(
        'messaging:session:conn-evo',
        JSON.stringify({
          status: 'CONNECTING',
          updatedAt: Date.now() - 10 * 60_000,
        }),
      );
      const spy = route([
        [/fetchInstances/, () => listed('open', `${OTHER}@s.whatsapp.net`)],
      ]);

      const session = await state.status(EVO as never);

      expect(session).toMatchObject({
        status: 'DISCONNECTED',
        error: 'PHONE_IN_USE',
      });
      expect(spy.mock.calls.some(([url]) => /logout/.test(url as string))).toBe(
        true,
      );
    });

    it('evento "conectou" não traz o número: confere no provider e aplica a regra', async () => {
      const { state, kv } = setup();
      const spy = route([
        [/fetchInstances/, () => listed('open', `${OTHER}@s.whatsapp.net`)],
      ]);

      await state.applyEvent({ ...EVO, phone: PHONE } as never, {
        kind: 'CONNECTION',
        status: 'CONNECTED',
      });

      expect(stored(kv)).toMatchObject({
        status: 'DISCONNECTED',
        error: 'PHONE_MISMATCH',
      });
      expect(spy.mock.calls.some(([url]) => /logout/.test(url as string))).toBe(
        true,
      );
    });

    it('o "desconectou" que o desfazer dispara não apaga o motivo', async () => {
      const { state, kv } = setup();
      kv.set(
        'messaging:session:conn-evo',
        JSON.stringify({
          status: 'DISCONNECTED',
          error: 'PHONE_MISMATCH',
          expectedPhone: PHONE,
          updatedAt: Date.now(),
        }),
      );
      await state.applyEvent({ ...EVO, phone: PHONE } as never, {
        kind: 'CONNECTION',
        status: 'DISCONNECTED',
      });
      expect(stored(kv)).toMatchObject({
        error: 'PHONE_MISMATCH',
        expectedPhone: PHONE,
      });
    });

    it('um novo pareamento (CONNECTING) limpa o erro antigo', async () => {
      const { state, kv } = setup();
      kv.set(
        'messaging:session:conn-evo',
        JSON.stringify({
          status: 'DISCONNECTED',
          error: 'PHONE_MISMATCH',
          expectedPhone: PHONE,
          updatedAt: Date.now(),
        }),
      );
      await state.applyEvent({ ...EVO, phone: PHONE } as never, {
        kind: 'CONNECTION',
        status: 'CONNECTING',
        qrCode: 'data:QR',
      });
      expect(stored(kv)).not.toHaveProperty('error');
    });

    it('provider fora do ar ao conferir o número pareado: mantém a sessão do evento tal como veio', async () => {
      const { state, kv } = setup();
      route([[/fetchInstances/, () => Promise.reject(new Error('timeout'))]]);

      await state.applyEvent({ ...EVO, phone: PHONE } as never, {
        kind: 'CONNECTION',
        status: 'CONNECTED',
      });

      expect(stored(kv)).toMatchObject({ status: 'CONNECTED' });
      expect(stored(kv)).not.toHaveProperty('error');
    });

    it('desfazer o pareamento mesmo quando o próprio disconnect() do provider rejeita', async () => {
      const { state, connections, kv } = setup();
      kv.set(
        'messaging:session:conn-evo',
        JSON.stringify({
          status: 'CONNECTING',
          updatedAt: Date.now() - 10 * 60_000,
        }),
      );
      route([
        [/fetchInstances/, () => listed('open', `${OTHER}@s.whatsapp.net`)],
      ]);
      const realUse = connections.use.bind(connections);
      vi.spyOn(connections, 'use').mockImplementation((conn) => {
        const real = realUse(conn);
        return {
          ...real,
          session: {
            ...real.session!,
            disconnect: () => Promise.reject(new Error('provider fora')),
          },
        };
      });

      const session = await state.status({ ...EVO, phone: PHONE } as never);

      expect(session).toMatchObject({
        status: 'DISCONNECTED',
        error: 'PHONE_MISMATCH',
      });
    });

    it('desconectar mantém a conexão e o número: só limpa o estado', async () => {
      const { state, connections, kv } = setup();
      const bind = vi.spyOn(connections, 'bindPhone');
      kv.set(
        'messaging:session:conn-evo',
        JSON.stringify({ status: 'CONNECTED', updatedAt: Date.now() }),
      );
      route([[/logout/, () => res({})]]);

      const result = await state.disconnect({ ...EVO, phone: PHONE } as never);

      expect(result.status).toBe(true);
      expect(kv.has('messaging:session:conn-evo')).toBe(false);
      expect(bind).not.toHaveBeenCalled(); // o número NÃO é desvinculado
    });
  });

  describe('conectar', () => {
    it('devolve o QR, grava o estado, derruba o health e avisa a tela', async () => {
      const { state, kv, redis, events } = setup();
      route([
        [/fetchInstances/, () => listed('close')],
        [
          /instance\/connect/,
          () => res({ qrcode: { base64: 'data:QR', pairingCode: 'PC' } }),
        ],
      ]);

      const session = await state.connect(EVO as never);

      expect(session).toMatchObject({
        status: 'CONNECTING',
        qrCode: 'data:QR',
      });
      expect(stored(kv)).toMatchObject({
        status: 'CONNECTING',
        qrCode: 'data:QR',
      });
      expect(redis.del).toHaveBeenCalledWith('messaging:health:conn-evo');
      expect(events.emit).toHaveBeenCalledWith({ type: 'connection' });
    });

    it('provider sem sessão (Meta) recusa com erro i18n', async () => {
      const { state } = setup([META]);
      await expect(state.connect(META as never)).rejects.toThrow(
        'messaging.session_not_supported',
      );
    });
  });

  // O evento Connected/PairSuccess do Go já traz o JID: o número é fixado sem consultar o
  // provider, e o pareamento recusado é desfeito no provider (logout), não só marcado.
  describe('Evolution Go: número vem no evento Connected', () => {
    const connected = {
      kind: 'CONNECTION' as const,
      status: 'CONNECTED' as const,
      phoneNumber: '5511918798714',
    };

    /** Qualquer chamada ao provider aqui é desvio de comportamento: o evento basta. */
    function noFetch() {
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(new Response('{}', { status: 200 }));
      return fetchSpy;
    }

    it('primeiro pareamento fixa o número sem consultar o provider', async () => {
      const { state, connections, kv } = setup([GO_CONNECTION]);
      const fetchSpy = noFetch();
      const bind = vi
        .spyOn(connections, 'bindPhone')
        .mockResolvedValue(GO_CONNECTION as never);

      await state.applyEvent(GO_CONNECTION as never, connected);

      expect(bind).toHaveBeenCalledWith('conn-go', '5511918798714');
      expect(stored(kv, 'conn-go')).toMatchObject({ status: 'CONNECTED' });
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('número já usado por outra conexão: desfaz o pareamento e marca PHONE_IN_USE', async () => {
      const { state, connections, kv } = setup([GO_CONNECTION]);
      const fetchSpy = noFetch();
      vi.spyOn(connections, 'bindPhone').mockRejectedValue(
        new ConflictException('x'),
      );

      await state.applyEvent(GO_CONNECTION as never, connected);

      expect(stored(kv, 'conn-go')).toMatchObject({
        status: 'DISCONNECTED',
        error: 'PHONE_IN_USE',
      });
      expect(fetchSpy).toHaveBeenCalledWith(
        'http://go:8080/instance/logout',
        expect.objectContaining({ method: 'DELETE' }),
      );
    });

    it('número diferente do da conexão: desfaz e marca PHONE_MISMATCH com o esperado', async () => {
      const { state, kv } = setup([GO_CONNECTION]);
      const fetchSpy = noFetch();

      await state.applyEvent(
        { ...GO_CONNECTION, phone: '5534998956461' } as never,
        connected,
      );

      expect(stored(kv, 'conn-go')).toMatchObject({
        status: 'DISCONNECTED',
        error: 'PHONE_MISMATCH',
        expectedPhone: '5534998956461',
      });
      expect(fetchSpy).toHaveBeenCalledWith(
        'http://go:8080/instance/logout',
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });
});
