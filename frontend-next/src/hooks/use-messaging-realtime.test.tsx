import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useMessagingRealtime } from './use-messaging-realtime';

const mocks = vi.hoisted(() => ({
  captured: null as null | {
    onEvent: (e: { type: string } & Record<string, unknown>) => void;
    onOpen: () => void;
  },
  unsubscribe: vi.fn(),
  subscribe: vi.fn(),
}));

vi.mock('@/lib/messaging/realtime', () => ({
  subscribeMessagingRealtime: (handlers: NonNullable<typeof mocks.captured>) => {
    mocks.captured = handlers;
    mocks.subscribe();
    return mocks.unsubscribe;
  },
}));

const DEBOUNCE_MS = 750;
const settle = () => act(() => void vi.advanceTimersByTime(DEBOUNCE_MS));

function setup() {
  const client = new QueryClient();
  const invalidate = vi.spyOn(client, 'invalidateQueries').mockResolvedValue();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { invalidate, ...renderHook(() => useMessagingRealtime(), { wrapper }) };
}

describe('useMessagingRealtime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mocks.captured = null;
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('conexão mudou: refaz sessão e saúde — a tela reflete a queda sem recarregar', () => {
    const { invalidate } = setup();
    mocks.captured!.onEvent({ type: 'connection' });
    settle();

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['messaging', 'connections'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['messaging', 'session'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['messaging', 'health'] });
    expect(invalidate).toHaveBeenCalledTimes(3);
  });

  it('mensagens e contatos refazem só a própria consulta', () => {
    const { invalidate } = setup();
    mocks.captured!.onEvent({ type: 'messages' });
    settle();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['messaging', 'messages'] });
    expect(invalidate).toHaveBeenCalledTimes(1);

    mocks.captured!.onEvent({ type: 'contacts' });
    settle();
    expect(invalidate).toHaveBeenLastCalledWith({ queryKey: ['messaging', 'contacts'] });
  });

  it('tipo de evento desconhecido (versão nova do backend) é ignorado', () => {
    const { invalidate } = setup();
    mocks.captured!.onEvent({ type: 'algo-novo' });
    settle();
    expect(invalidate).not.toHaveBeenCalled();
  });

  // Presença é estado efêmero (useTypingIndicator), não "refaça a consulta": nunca invalida nada.
  it('presença não invalida nenhuma consulta', () => {
    const { invalidate } = setup();
    mocks.captured!.onEvent({ type: 'presence', connectionId: 'c1', phone: '1', state: 'COMPOSING' });
    settle();
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('ao (re)conectar refaz tudo de mensageria, porque eventos podem ter se perdido', () => {
    const { invalidate } = setup();
    mocks.captured!.onOpen();
    settle();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['messaging'] });
  });

  it('desmontar cancela a assinatura', () => {
    const { unmount } = setup();
    unmount();
    expect(mocks.unsubscribe).toHaveBeenCalledOnce();
  });

  it('vários componentes usando o hook compartilham um único assinante', () => {
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, 'invalidateQueries').mockResolvedValue();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const a = renderHook(() => useMessagingRealtime(), { wrapper });
    const b = renderHook(() => useMessagingRealtime(), { wrapper });
    const c = renderHook(() => useMessagingRealtime(), { wrapper });
    expect(mocks.subscribe).toHaveBeenCalledOnce();

    mocks.captured!.onEvent({ type: 'contacts' });
    settle();
    expect(invalidate).toHaveBeenCalledTimes(1);

    a.unmount();
    b.unmount();
    expect(mocks.unsubscribe).not.toHaveBeenCalled();
    c.unmount();
    expect(mocks.unsubscribe).toHaveBeenCalledOnce();
  });

  it('rajada de eventos vira uma rodada só, sem repetir a mesma consulta', () => {
    const { invalidate } = setup();
    for (let i = 0; i < 50; i++) {
      mocks.captured!.onEvent({ type: 'messages' });
      mocks.captured!.onEvent({ type: 'contacts' });
    }
    expect(invalidate).not.toHaveBeenCalled();

    settle();
    expect(invalidate).toHaveBeenCalledTimes(2);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['messaging', 'messages'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['messaging', 'contacts'] });
  });

  it('reconexão junto de eventos refaz só a raiz de mensageria', () => {
    const { invalidate } = setup();
    mocks.captured!.onEvent({ type: 'contacts' });
    mocks.captured!.onOpen();
    settle();
    expect(invalidate).toHaveBeenCalledOnce();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['messaging'] });
  });

  it('desmontar descarta o que estava aguardando o debounce', () => {
    const { invalidate, unmount } = setup();
    mocks.captured!.onEvent({ type: 'messages' });
    unmount();
    settle();
    expect(invalidate).not.toHaveBeenCalled();
  });
});
