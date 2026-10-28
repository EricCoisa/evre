import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 2;
  readyState = FakeEventSource.CONNECTING;
  onopen: (() => void) | null = null;
  onmessage: ((m: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;
  constructor(readonly url: string) {
    FakeEventSource.instances.push(this);
  }
  close() {
    this.closed = true;
    this.readyState = FakeEventSource.CLOSED;
  }
  open() {
    this.readyState = FakeEventSource.OPEN;
    this.onopen?.();
  }
  emit(data: unknown) {
    this.onmessage?.({ data: typeof data === 'string' ? data : JSON.stringify(data) });
  }
  fail(finalState: number) {
    this.readyState = finalState;
    this.onerror?.();
  }
}

async function load() {
  vi.resetModules();
  return import('./realtime');
}

describe('realtime (SSE)', () => {
  beforeEach(() => {
    FakeEventSource.instances = [];
    vi.useFakeTimers();
    vi.stubGlobal('EventSource', FakeEventSource);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const handlers = () => ({ onEvent: vi.fn(), onOpen: vi.fn() });

  it('abre uma conexão no endpoint do proxy e entrega eventos', async () => {
    const { subscribeMessagingRealtime } = await load();
    const h = handlers();
    subscribeMessagingRealtime(h);

    const source = FakeEventSource.instances[0];
    expect(source.url).toBe('/api/messaging/events');
    source.open();
    source.emit({ type: 'messages' });

    expect(h.onOpen).toHaveBeenCalledOnce();
    expect(h.onEvent).toHaveBeenCalledWith({ type: 'messages' });
  });

  it('várias telas, uma única conexão; fecha só quando a última sai', async () => {
    const { subscribeMessagingRealtime } = await load();
    const stopA = subscribeMessagingRealtime(handlers());
    const stopB = subscribeMessagingRealtime(handlers());
    expect(FakeEventSource.instances).toHaveLength(1);

    stopA();
    expect(FakeEventSource.instances[0].closed).toBe(false);
    stopB();
    expect(FakeEventSource.instances[0].closed).toBe(true);
  });

  it('quem chega com o stream já aberto é avisado (refaz a consulta)', async () => {
    const { subscribeMessagingRealtime } = await load();
    subscribeMessagingRealtime(handlers());
    FakeEventSource.instances[0].open();

    const late = handlers();
    subscribeMessagingRealtime(late);
    expect(late.onOpen).toHaveBeenCalledOnce();
  });

  it('evento fora do formato é ignorado sem derrubar o stream', async () => {
    const { subscribeMessagingRealtime } = await load();
    const h = handlers();
    subscribeMessagingRealtime(h);
    const source = FakeEventSource.instances[0];
    source.open();

    source.emit('{quebrado');
    source.emit({ type: 'contacts' });
    expect(h.onEvent).toHaveBeenCalledTimes(1);
  });

  it('depois de queda de rede, quem chega só é avisado quando a conexão reabrir', async () => {
    const { subscribeMessagingRealtime } = await load();
    subscribeMessagingRealtime(handlers());
    const source = FakeEventSource.instances[0];
    source.open();
    source.fail(FakeEventSource.CONNECTING); // queda de rede: o navegador reconecta sozinho

    const late = handlers();
    subscribeMessagingRealtime(late);
    expect(late.onOpen).not.toHaveBeenCalled();

    source.open();
    expect(late.onOpen).toHaveBeenCalledOnce();
  });

  const stubProbe = (...statuses: number[]) => {
    const fetchMock = vi.fn();
    for (const status of statuses) {
      fetchMock.mockResolvedValueOnce({ status, ok: status >= 200 && status < 300 });
    }
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  };

  it('erro HTTP (navegador desiste) sonda em 5s, reabre se o endpoint responde e avisa de novo', async () => {
    const fetchMock = stubProbe(200);
    const { subscribeMessagingRealtime } = await load();
    const h = handlers();
    subscribeMessagingRealtime(h);
    FakeEventSource.instances[0].open();

    FakeEventSource.instances[0].fail(FakeEventSource.CLOSED);
    expect(FakeEventSource.instances).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(4999);
    expect(fetchMock).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(FakeEventSource.instances).toHaveLength(2);

    FakeEventSource.instances[1].open();
    expect(h.onOpen).toHaveBeenCalledTimes(2);
  });

  it('429/5xx: espera mais a cada tentativa (5s, 10s, 20s...) em vez de martelar', async () => {
    const fetchMock = stubProbe(429, 502, 200);
    const { subscribeMessagingRealtime } = await load();
    subscribeMessagingRealtime(handlers());
    FakeEventSource.instances[0].fail(FakeEventSource.CLOSED);

    await vi.advanceTimersByTimeAsync(5000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(9999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(20000);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(FakeEventSource.instances).toHaveLength(2);
  });

  it('o backoff volta ao início depois de reconectar', async () => {
    const fetchMock = stubProbe(502, 200, 200);
    const { subscribeMessagingRealtime } = await load();
    subscribeMessagingRealtime(handlers());
    FakeEventSource.instances[0].fail(FakeEventSource.CLOSED);
    await vi.advanceTimersByTimeAsync(5000 + 10000);
    FakeEventSource.instances[1].open();

    FakeEventSource.instances[1].fail(FakeEventSource.CLOSED);
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('sessão expirada (401): para de reconectar; tela montada depois tenta de novo', async () => {
    const fetchMock = stubProbe(401, 200);
    const { subscribeMessagingRealtime } = await load();
    subscribeMessagingRealtime(handlers());
    FakeEventSource.instances[0].fail(FakeEventSource.CLOSED);

    await vi.advanceTimersByTimeAsync(5000);
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(FakeEventSource.instances).toHaveLength(1);

    subscribeMessagingRealtime(handlers());
    expect(FakeEventSource.instances).toHaveLength(2);
  });

  it('sair da tela cancela a sonda pendente', async () => {
    const fetchMock = stubProbe(200);
    const { subscribeMessagingRealtime } = await load();
    const stop = subscribeMessagingRealtime(handlers());
    FakeEventSource.instances[0].fail(FakeEventSource.CLOSED);
    stop();

    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(FakeEventSource.instances).toHaveLength(1);
  });

  it('fim de vida do stream (não é erro) reconecta na hora, sem esperar o backoff', async () => {
    const { subscribeMessagingRealtime } = await load();
    const h = handlers();
    subscribeMessagingRealtime(h);
    FakeEventSource.instances[0].open();

    FakeEventSource.instances[0].emit({ type: 'end' });

    expect(FakeEventSource.instances[0].closed).toBe(true);
    expect(FakeEventSource.instances).toHaveLength(2);

    FakeEventSource.instances[1].open();
    expect(h.onOpen).toHaveBeenCalledTimes(2);
  });

  it('sair durante a espera da reconexão cancela a tentativa', async () => {
    const { subscribeMessagingRealtime } = await load();
    const stop = subscribeMessagingRealtime(handlers());
    FakeEventSource.instances[0].fail(FakeEventSource.CLOSED);
    stop();
    vi.advanceTimersByTime(10_000);
    expect(FakeEventSource.instances).toHaveLength(1);
  });

  it('erro de rede na sonda (fetch rejeita): espera e tenta de novo como nos outros erros', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ status: 200, ok: true });
    vi.stubGlobal('fetch', fetchMock);
    const { subscribeMessagingRealtime } = await load();
    subscribeMessagingRealtime(handlers());
    FakeEventSource.instances[0].fail(FakeEventSource.CLOSED);

    await vi.advanceTimersByTimeAsync(5000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(10000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(FakeEventSource.instances).toHaveLength(2);
  });

  it('cancela a sonda em andamento (sucesso chega tarde) sem reabrir', async () => {
    let resolveFetch!: (v: { status: number; ok: boolean }) => void;
    const fetchMock = vi.fn(() => new Promise((resolve) => { resolveFetch = resolve; }));
    vi.stubGlobal('fetch', fetchMock);
    const { subscribeMessagingRealtime } = await load();
    const stop = subscribeMessagingRealtime(handlers());
    FakeEventSource.instances[0].fail(FakeEventSource.CLOSED);

    await vi.advanceTimersByTimeAsync(5000);
    expect(fetchMock).toHaveBeenCalledOnce();

    stop();
    resolveFetch({ status: 200, ok: true });
    await vi.advanceTimersByTimeAsync(0);

    expect(FakeEventSource.instances).toHaveLength(1);
  });

  it('cancela a sonda em andamento (erro de rede chega tarde) sem reagendar', async () => {
    let rejectFetch!: (e: Error) => void;
    const fetchMock = vi.fn(() => new Promise((_resolve, reject) => { rejectFetch = reject; }));
    vi.stubGlobal('fetch', fetchMock);
    const { subscribeMessagingRealtime } = await load();
    const stop = subscribeMessagingRealtime(handlers());
    FakeEventSource.instances[0].fail(FakeEventSource.CLOSED);

    await vi.advanceTimersByTimeAsync(5000);
    expect(fetchMock).toHaveBeenCalledOnce();

    stop();
    rejectFetch(new Error('network down'));
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(60_000);

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(FakeEventSource.instances).toHaveLength(1);
  });

  it('navegador sem EventSource não quebra: a tela cai no polling', async () => {
    vi.unstubAllGlobals();
    const { subscribeMessagingRealtime } = await load();
    expect(() => subscribeMessagingRealtime(handlers())()).not.toThrow();
  });
});
