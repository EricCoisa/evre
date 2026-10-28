import { MessagingEventsService } from './messaging-events.service';

function setup() {
  let onMessage: (raw: string) => void = () => undefined;
  const redis = {
    subscribe: vi.fn((_channel: string, handler: (raw: string) => void) => {
      onMessage = handler;
      return Promise.resolve();
    }),
    publish: vi.fn().mockResolvedValue(undefined),
  };
  const service = new MessagingEventsService(redis as never);
  return { service, redis, deliver: (raw: string) => onMessage(raw) };
}

describe('MessagingEventsService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('emit chega a quem está escutando neste processo e vai ao Redis para os outros', () => {
    const { service, redis } = setup();
    const seen: unknown[] = [];
    service.stream().subscribe((e) => seen.push(e));

    service.emit({ type: 'messages' });

    expect(seen).toEqual([{ type: 'messages' }]);
    const [channel, payload] = redis.publish.mock.calls[0];
    expect(channel).toBe('messaging:events');
    expect(JSON.parse(payload).event).toEqual({ type: 'messages' });
  });

  it('evento vindo de OUTRO processo é entregue; o eco do próprio não duplica', async () => {
    const { service, redis, deliver } = setup();
    await service.onModuleInit();
    const seen: unknown[] = [];
    service.stream().subscribe((e) => seen.push(e));

    deliver(
      JSON.stringify({
        origin: 'outro-processo',
        event: { type: 'connection' },
      }),
    );
    expect(seen).toEqual([{ type: 'connection' }]);

    service.emit({ type: 'contacts' });
    const own = redis.publish.mock.calls[0][1] as string;
    deliver(own); // o Redis devolve o que este processo mesmo publicou
    expect(seen).toEqual([{ type: 'connection' }, { type: 'contacts' }]);
  });

  it('lixo no canal é ignorado', async () => {
    const { service, deliver } = setup();
    await service.onModuleInit();
    const seen: unknown[] = [];
    service.stream().subscribe((e) => seen.push(e));
    deliver('não é json');
    deliver(JSON.stringify({ origin: 'x' }));
    expect(seen).toEqual([]);
  });

  describe('attach (SSE)', () => {
    it('abre com comentário, escreve cada evento no formato SSE e mantém a conexão viva', () => {
      const { service } = setup();
      const written: string[] = [];
      const detach = service.attach((chunk) => written.push(chunk), vi.fn());
      expect(written[0]).toBe(': connected\n\n');

      service.emit({ type: 'connection' });
      expect(written[1]).toBe('data: {"type":"connection"}\n\n');

      vi.advanceTimersByTime(25_000);
      expect(written.at(-1)).toBe(': ping\n\n');
      detach();
    });

    it('depois de desanexar não escreve mais — nem evento, nem ping', () => {
      const { service } = setup();
      const written: string[] = [];
      const detach = service.attach((chunk) => written.push(chunk), vi.fn());
      detach();
      const count = written.length;

      service.emit({ type: 'messages' });
      vi.advanceTimersByTime(60_000);
      expect(written).toHaveLength(count);
    });

    it('no limite de vida, avisa o fim e encerra a conexão', () => {
      const { service } = setup();
      const written: string[] = [];
      const end = vi.fn();
      service.attach((chunk) => written.push(chunk), end);

      vi.advanceTimersByTime(10 * 60_000);

      expect(written.at(-1)).toBe('data: {"type":"end"}\n\n');
      expect(end).toHaveBeenCalledOnce();
    });

    it('desanexar antes do limite de vida cancela o fechamento automático', () => {
      const { service } = setup();
      const end = vi.fn();
      const detach = service.attach(() => undefined, end);
      detach();

      vi.advanceTimersByTime(10 * 60_000);

      expect(end).not.toHaveBeenCalled();
    });
  });
});
