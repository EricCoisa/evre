import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { MessagingMessage } from '@/lib/actions/messaging/types';
import { MessageList } from './message-list';

const mocks = vi.hoisted(() => ({
  thread: {} as Record<string, unknown>,
  fetchNextPage: vi.fn(),
  refetch: vi.fn(),
}));

vi.mock('@/lib/actions/messaging/queries', () => ({
  useMessageThread: () => mocks.thread,
}));
vi.mock('@/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key, locale: 'pt-BR' }),
}));

const msg = (id: string, createdAt: string, direction: 'INBOUND' | 'OUTBOUND' = 'INBOUND'): MessagingMessage => ({
  id,
  connectionId: 'conn-1',
  direction,
  status: 'DELIVERED',
  phone: '5511999990001',
  type: 'TEXT',
  text: `texto-${id}`,
  createdAt,
});

const page = (data: MessagingMessage[]) => ({ data, meta: { total: data.length, page: 1, limit: 30, totalPages: 1 } });

function setThread(over: Record<string, unknown> = {}) {
  mocks.thread = {
    data: { pages: [page([])] },
    isPending: false,
    isError: false,
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: mocks.fetchNextPage,
    refetch: mocks.refetch,
    ...over,
  };
}

/** jsdom não faz layout: injeta as medidas que o scroll usa. */
function setMetrics(el: HTMLElement, m: { scrollTop: number; scrollHeight: number; clientHeight: number }) {
  Object.defineProperty(el, 'scrollHeight', { configurable: true, value: m.scrollHeight });
  Object.defineProperty(el, 'clientHeight', { configurable: true, value: m.clientHeight });
  el.scrollTop = m.scrollTop;
}

describe('MessageList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setThread();
  });

  it('mostra carregando, vazio e erro com retry', () => {
    setThread({ isPending: true, data: undefined });
    const { rerender } = render(<MessageList connectionId="conn-1" phone="1" scrollSignal={0} />);
    expect(screen.getByText('loadingMessages')).toBeInTheDocument();

    setThread();
    rerender(<MessageList connectionId="conn-1" phone="1" scrollSignal={0} />);
    expect(screen.getByText('emptyThread')).toBeInTheDocument();

    setThread({ isError: true, data: undefined });
    rerender(<MessageList connectionId="conn-1" phone="1" scrollSignal={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'retry' }));
    expect(mocks.refetch).toHaveBeenCalledOnce();
  });

  it('exibe em ordem cronológica (a API devolve da mais nova para a mais antiga) com um separador por dia', () => {
    setThread({
      data: {
        pages: [
          page([msg('c', '2026-10-03T12:00:00'), msg('b', '2026-10-02T12:00:00')]),
          page([msg('a', '2026-10-02T08:00:00')]),
        ],
      },
    });
    render(<MessageList connectionId="conn-1" phone="1" scrollSignal={0} />);

    const order = screen.getAllByText(/^texto-/).map((el) => el.textContent);
    expect(order).toEqual(['texto-a', 'texto-b', 'texto-c']);
    expect(document.querySelectorAll('.sticky')).toHaveLength(2);
  });

  it('chegar ao topo carrega as mensagens anteriores', () => {
    setThread({ data: { pages: [page([msg('a', '2026-10-03T12:00:00')])] }, hasNextPage: true });
    render(<MessageList connectionId="conn-1" phone="1" scrollSignal={0} />);
    const scroller = screen.getByTestId('message-scroller');

    setMetrics(scroller, { scrollTop: 10, scrollHeight: 1000, clientHeight: 400 });
    fireEvent.scroll(scroller);
    expect(mocks.fetchNextPage).toHaveBeenCalledOnce();
  });

  it('não pede mais páginas quando não há ou já está carregando', () => {
    setThread({ data: { pages: [page([msg('a', '2026-10-03T12:00:00')])] }, hasNextPage: false });
    const { rerender } = render(<MessageList connectionId="conn-1" phone="1" scrollSignal={0} />);
    const scroller = screen.getByTestId('message-scroller');
    setMetrics(scroller, { scrollTop: 0, scrollHeight: 1000, clientHeight: 400 });
    fireEvent.scroll(scroller);

    setThread({
      data: { pages: [page([msg('a', '2026-10-03T12:00:00')])] },
      hasNextPage: true,
      isFetchingNextPage: true,
    });
    rerender(<MessageList connectionId="conn-1" phone="1" scrollSignal={0} />);
    fireEvent.scroll(screen.getByTestId('message-scroller'));
    expect(mocks.fetchNextPage).not.toHaveBeenCalled();
    expect(screen.getByRole('status', { name: 'loadingOlder' })).toBeInTheDocument();
  });

  it('ao rolar para cima aparece o botão de ir ao fim, e ele leva ao fim', () => {
    setThread({ data: { pages: [page([msg('a', '2026-10-03T12:00:00')])] } });
    render(<MessageList connectionId="conn-1" phone="1" scrollSignal={0} />);
    const scroller = screen.getByTestId('message-scroller');
    expect(screen.queryByRole('button', { name: 'jumpToBottom' })).not.toBeInTheDocument();

    setMetrics(scroller, { scrollTop: 300, scrollHeight: 2000, clientHeight: 400 });
    fireEvent.scroll(scroller);
    fireEvent.click(screen.getByRole('button', { name: 'jumpToBottom' }));
    expect(scroller.scrollTop).toBe(2000);
  });

  it('mensagem nova NÃO puxa o scroll de quem está lendo o histórico', () => {
    setThread({ data: { pages: [page([msg('a', '2026-10-03T12:00:00')])] } });
    const { rerender } = render(<MessageList connectionId="conn-1" phone="1" scrollSignal={0} />);
    const scroller = screen.getByTestId('message-scroller');
    setMetrics(scroller, { scrollTop: 300, scrollHeight: 2000, clientHeight: 400 });
    fireEvent.scroll(scroller);

    setThread({
      data: { pages: [page([msg('b', '2026-10-03T12:05:00'), msg('a', '2026-10-03T12:00:00')])] },
    });
    rerender(<MessageList connectionId="conn-1" phone="1" scrollSignal={0} />);
    expect(scroller.scrollTop).toBe(300);
  });

  it('quem está no fim acompanha a mensagem nova', () => {
    setThread({ data: { pages: [page([msg('a', '2026-10-03T12:00:00')])] } });
    const { rerender } = render(<MessageList connectionId="conn-1" phone="1" scrollSignal={0} />);
    const scroller = screen.getByTestId('message-scroller');
    setMetrics(scroller, { scrollTop: 1600, scrollHeight: 2000, clientHeight: 400 });
    fireEvent.scroll(scroller);

    setMetrics(scroller, { scrollTop: 1600, scrollHeight: 2100, clientHeight: 400 });
    setThread({
      data: { pages: [page([msg('b', '2026-10-03T12:05:00'), msg('a', '2026-10-03T12:00:00')])] },
    });
    rerender(<MessageList connectionId="conn-1" phone="1" scrollSignal={0} />);
    expect(scroller.scrollTop).toBe(2100);
  });

  it('enviar leva ao fim mesmo para quem estava no histórico', () => {
    setThread({ data: { pages: [page([msg('a', '2026-10-03T12:00:00')])] } });
    const { rerender } = render(<MessageList connectionId="conn-1" phone="1" scrollSignal={0} />);
    const scroller = screen.getByTestId('message-scroller');
    setMetrics(scroller, { scrollTop: 300, scrollHeight: 2000, clientHeight: 400 });
    fireEvent.scroll(scroller);

    rerender(<MessageList connectionId="conn-1" phone="1" scrollSignal={1} />);
    expect(scroller.scrollTop).toBe(2000);
  });

  it('ancora o scroll no conteúdo lido ao prepend das mensagens mais antigas', () => {
    setThread({ data: { pages: [page([msg('a', '2026-10-03T12:00:00')])] }, hasNextPage: true });
    const { rerender } = render(<MessageList connectionId="conn-1" phone="1" scrollSignal={0} />);
    const scroller = screen.getByTestId('message-scroller');

    setMetrics(scroller, { scrollTop: 10, scrollHeight: 1000, clientHeight: 400 });
    fireEvent.scroll(scroller);
    expect(mocks.fetchNextPage).toHaveBeenCalledOnce();

    setThread({
      data: { pages: [page([msg('a', '2026-10-03T12:00:00')]), page([msg('older', '2026-10-01T12:00:00')])] },
      hasNextPage: true,
    });
    setMetrics(scroller, { scrollTop: 10, scrollHeight: 1300, clientHeight: 400 });
    rerender(<MessageList connectionId="conn-1" phone="1" scrollSignal={0} />);

    // scrollTop(10) + (novo scrollHeight 1300 - altura salva antes do prepend 1000) = 310
    expect(scroller.scrollTop).toBe(310);
  });
});

describe('MessageList — resize do conteúdo (mídia carregando)', () => {
  class FakeResizeObserver {
    static instances: FakeResizeObserver[] = [];
    callback: () => void;
    observe = vi.fn();
    disconnect = vi.fn();
    constructor(callback: () => void) {
      this.callback = callback;
      FakeResizeObserver.instances.push(this);
    }
  }

  beforeEach(() => {
    vi.clearAllMocks();
    setThread({ data: { pages: [page([msg('a', '2026-10-03T12:00:00')])] } });
    FakeResizeObserver.instances = [];
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('quando o conteúdo muda de altura e o usuário está no fim, rola para o fim', () => {
    render(<MessageList connectionId="conn-1" phone="1" scrollSignal={0} />);
    const scroller = screen.getByTestId('message-scroller');
    setMetrics(scroller, { scrollTop: 0, scrollHeight: 500, clientHeight: 400 });

    FakeResizeObserver.instances[0].callback();

    expect(scroller.scrollTop).toBe(500);
  });

  it('se o usuário saiu do fim, o resize do conteúdo não força o scroll', () => {
    render(<MessageList connectionId="conn-1" phone="1" scrollSignal={0} />);
    const scroller = screen.getByTestId('message-scroller');
    setMetrics(scroller, { scrollTop: 300, scrollHeight: 2000, clientHeight: 400 });
    fireEvent.scroll(scroller);

    setMetrics(scroller, { scrollTop: 300, scrollHeight: 2500, clientHeight: 400 });
    FakeResizeObserver.instances[0].callback();

    expect(scroller.scrollTop).toBe(300);
  });

  it('desconecta o observer ao desmontar', () => {
    const { unmount } = render(<MessageList connectionId="conn-1" phone="1" scrollSignal={0} />);
    const observer = FakeResizeObserver.instances[0];

    unmount();

    expect(observer.disconnect).toHaveBeenCalled();
  });
});
