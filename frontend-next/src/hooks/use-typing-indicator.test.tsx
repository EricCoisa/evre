import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useTypingIndicator } from './use-typing-indicator';

type PresenceEvent = { type: 'presence'; connectionId: string; phone: string; state: string };
type Handlers = { onEvent: (e: PresenceEvent) => void; onOpen: () => void };

const mocks = vi.hoisted(() => ({
  captured: null as Handlers | null,
  unsubscribe: vi.fn(),
}));

vi.mock('@/lib/messaging/realtime', () => ({
  subscribeMessagingRealtime: (handlers: Handlers) => {
    mocks.captured = handlers;
    return mocks.unsubscribe;
  },
}));

const emit = (event: PresenceEvent) => act(() => mocks.captured!.onEvent(event));
const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));

describe('useTypingIndicator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mocks.captured = null;
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('nasce sem indicador', () => {
    const { result } = renderHook(() => useTypingIndicator('c1', '5511987654321'));
    expect(result.current).toBeNull();
  });

  it('COMPOSING liga o indicador; PAUSED desliga antes do TTL', () => {
    const { result } = renderHook(() => useTypingIndicator('c1', '5511987654321'));

    emit({ type: 'presence', connectionId: 'c1', phone: '5511987654321', state: 'COMPOSING' });
    expect(result.current).toBe('COMPOSING');

    emit({ type: 'presence', connectionId: 'c1', phone: '5511987654321', state: 'PAUSED' });
    expect(result.current).toBeNull();
  });

  it('expira sozinho em ~10s se não renovado (PAUSED nunca chegou)', () => {
    const { result } = renderHook(() => useTypingIndicator('c1', '5511987654321'));
    emit({ type: 'presence', connectionId: 'c1', phone: '5511987654321', state: 'COMPOSING' });
    expect(result.current).toBe('COMPOSING');

    advance(9999);
    expect(result.current).toBe('COMPOSING');
    advance(1);
    expect(result.current).toBeNull();
  });

  it('renovar antes do TTL não deixa expirar', () => {
    const { result } = renderHook(() => useTypingIndicator('c1', '5511987654321'));
    emit({ type: 'presence', connectionId: 'c1', phone: '5511987654321', state: 'COMPOSING' });

    advance(8000);
    emit({ type: 'presence', connectionId: 'c1', phone: '5511987654321', state: 'COMPOSING' });
    advance(8000);
    expect(result.current).toBe('COMPOSING');
  });

  it('ignora evento de outra conexão ou outro telefone', () => {
    const { result } = renderHook(() => useTypingIndicator('c1', '5511987654321'));
    emit({ type: 'presence', connectionId: 'c2', phone: '5511987654321', state: 'COMPOSING' });
    emit({ type: 'presence', connectionId: 'c1', phone: 'outro', state: 'COMPOSING' });
    expect(result.current).toBeNull();
  });

  it('RECORDING liga o indicador de gravação', () => {
    const { result } = renderHook(() => useTypingIndicator('c1', '5511987654321'));
    emit({ type: 'presence', connectionId: 'c1', phone: '5511987654321', state: 'RECORDING' });
    expect(result.current).toBe('RECORDING');
  });

  it('desmontar cancela a assinatura', () => {
    const { unmount } = renderHook(() => useTypingIndicator('c1', '5511987654321'));
    unmount();
    expect(mocks.unsubscribe).toHaveBeenCalledOnce();
  });
});
