import { UnrecoverableError } from 'bullmq';
import { MessagingNonRetryableError } from './messaging.errors';
import { SEND_PROCESSORS } from './messaging.processor';
import { MessagingService } from './messaging.service';
import { ProviderRequestError } from './providers/provider-http.util';
import {
  INBOUND_JOB_OPTIONS,
  MESSAGING_SEND_PARTITIONS,
  MESSAGING_SEND_RETRY_DELAYS_MS,
  SEND_QUEUE_NAMES,
  buttonJobOptions,
  sendJobOptions,
  sendPartition,
} from './messaging-queue.const';

// As pausas viram registro: o teste confere os tempos sem esperá-los.
const pauses: number[] = [];
vi.mock('timers/promises', () => ({
  setTimeout: (ms: number) => {
    pauses.push(ms);
    return Promise.resolve();
  },
}));

const job = (data: object) => ({ data }) as never;

describe('processors de envio (um por partição)', () => {
  const messaging = { dispatch: vi.fn() };
  const [Processor] = SEND_PROCESSORS;
  let processor: InstanceType<typeof Processor>;

  beforeEach(() => {
    vi.clearAllMocks();
    pauses.length = 0;
    messaging.dispatch.mockResolvedValue(undefined);
    processor = new Processor(messaging as never);
  });

  const run = async (data: object) => {
    return processor.process(job(data)).then(
      () => 'ok' as const,
      (error: unknown) => error,
    );
  };

  it('há um processor por fila de envio, cada um com o nome da sua partição', () => {
    expect(SEND_PROCESSORS).toHaveLength(MESSAGING_SEND_PARTITIONS);
    expect(SEND_QUEUE_NAMES[0]).toBe('messaging'); // jobs antigos da fila única continuam sendo atendidos
    expect(new Set(SEND_QUEUE_NAMES).size).toBe(MESSAGING_SEND_PARTITIONS);
  });

  // O Nest injeta pelo tipo do parâmetro do construtor: sem esse metadado o serviço chega `undefined`.
  it.each(SEND_PROCESSORS.map((P, i) => [SEND_QUEUE_NAMES[i], P] as const))(
    'partição %s: o Nest sabe injetar o MessagingService',
    (_name, P) => {
      expect(Reflect.getMetadata('design:paramtypes', P)).toEqual([
        MessagingService,
      ]);
    },
  );

  it('repassa id, conteúdo do job e a permissão de furar o opt-out', async () => {
    const input = { type: 'TEXT', phone: '1', text: 'x' };
    expect(await run({ messageId: 'm1', input, bypassOptOut: true })).toBe(
      'ok',
    );
    expect(messaging.dispatch).toHaveBeenCalledWith('m1', input, {
      bypassOptOut: true,
      retriesLeft: MESSAGING_SEND_RETRY_DELAYS_MS.length,
    });
  });

  it('erro transitório: repete dentro do worker até dar certo, avisando quantas tentativas restam', async () => {
    messaging.dispatch
      .mockRejectedValueOnce(new ProviderRequestError('x', 503, 'x'))
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValue(undefined);
    expect(await run({ messageId: 'm1' })).toBe('ok');
    expect(
      messaging.dispatch.mock.calls.map(([, , o]) => o.retriesLeft),
    ).toEqual([3, 2, 1]);
  });

  it('esgotadas as pausas, devolve o erro (a mensagem fica FAILED) — 1 envio + 3 repetições', async () => {
    const failure = new ProviderRequestError('x', 500, 'x');
    messaging.dispatch.mockRejectedValue(failure);
    expect(await run({ messageId: 'm1' })).toBe(failure);
    expect(messaging.dispatch).toHaveBeenCalledTimes(
      MESSAGING_SEND_RETRY_DELAYS_MS.length + 1,
    );
    expect(messaging.dispatch.mock.calls.at(-1)?.[2].retriesLeft).toBe(0);
  });

  it('as pausas entre as tentativas são as de MESSAGING_SEND_RETRY_DELAYS_MS', async () => {
    messaging.dispatch.mockRejectedValue(
      new ProviderRequestError('x', 500, 'x'),
    );
    await run({ messageId: 'm1' });
    expect(pauses).toEqual([...MESSAGING_SEND_RETRY_DELAYS_MS]);
  });

  it.each([
    ['HTTP 400', new ProviderRequestError('x', 400, 'x')],
    ['erro comum', new Error('bug')],
  ])(
    '%s não se repete: um envio só, erro devolvido',
    async (_name, failure) => {
      messaging.dispatch.mockRejectedValue(failure);
      expect(await run({ messageId: 'm1' })).toBe(failure);
      expect(messaging.dispatch).toHaveBeenCalledTimes(1);
    },
  );

  it('erro sem retry vira UnrecoverableError, sem repetir', async () => {
    messaging.dispatch.mockRejectedValue(
      new MessagingNonRetryableError('opt-out'),
    );
    expect(await run({ messageId: 'm1' })).toBeInstanceOf(UnrecoverableError);
    expect(messaging.dispatch).toHaveBeenCalledTimes(1);
  });
});

describe('sendPartition', () => {
  it('é estável para a mesma conversa e sempre cai numa partição existente', () => {
    const a = sendPartition('conn-1', 'contact-1');
    expect(sendPartition('conn-1', 'contact-1')).toBe(a);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(MESSAGING_SEND_PARTITIONS);
  });

  it('espalha as conversas por todas as partições', () => {
    const seen = new Set(
      Array.from({ length: 400 }, (_, i) => sendPartition('conn-1', `c${i}`)),
    );
    expect(seen.size).toBe(MESSAGING_SEND_PARTITIONS);
  });
});

describe('opções de job da mensageria', () => {
  // O envio tem UMA tentativa na fila: as repetições são do worker, que preserva a ordem.
  it('envio: jobId é o id da mensagem, 1 tentativa; falha comum fica 7 dias, a de variável sensível 1 hora', () => {
    expect(sendJobOptions('m1', false)).toMatchObject({
      jobId: 'm1',
      attempts: 1,
      removeOnFail: { age: 7 * 24 * 3600, count: 1000 },
    });
    expect(sendJobOptions('m1', true).removeOnFail).toEqual({ age: 3600 });
  });

  it('inbound e botões também não retêm job falho para sempre', () => {
    expect(INBOUND_JOB_OPTIONS.removeOnFail).toMatchObject({
      age: expect.any(Number),
    });
    expect(buttonJobOptions('e1')).toMatchObject({
      jobId: 'e1',
      removeOnFail: { age: expect.any(Number) },
    });
  });
});
