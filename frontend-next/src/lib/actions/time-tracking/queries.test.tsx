import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

vi.mock('./api', () => ({
  getActiveTimer: vi.fn(),
  startTimer: vi.fn(),
  stopTimer: vi.fn(),
  createManualTimeEntry: vi.fn(),
  updateTimeEntry: vi.fn(),
  deleteTimeEntry: vi.fn(),
  listTimeEntries: vi.fn(),
  exportTimeEntries: vi.fn(),
}));
vi.mock('@/lib/api/collector', () => ({
  Collector: (fn: () => unknown) => fn,
  Alive: (fn: () => unknown) => async () => {
    const result = await (fn as () => Promise<unknown>)();
    return (result as { data: unknown })?.data ?? result;
  },
}));
vi.mock('@/contexts/appProvider', () => ({
  useApp: () => ({ emulateError: false }),
}));

import { getActiveTimer, startTimer, stopTimer, listTimeEntries } from './api';
import { useActiveTimer, useStartTimer, useStopTimer, useTimeEntries } from './queries';

function ok<T>(data: T) {
  return { success: true, data, message: '', status: 200 } as const;
}

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useActiveTimer', () => {
  it('retorna o timer ativo', async () => {
    const activeData = { entry: { id: 'e1' }, isForgotten: false, thresholdHours: 8 };
    vi.mocked(getActiveTimer).mockResolvedValue(ok(activeData) as never);

    const { result } = renderHook(() => useActiveTimer(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getActiveTimer).toHaveBeenCalledOnce();
  });
});

describe('useStartTimer', () => {
  it('inicia timer e invalida queries', async () => {
    const entry = { id: 'e1', startTime: '2024-01-01T09:00:00Z' };
    vi.mocked(startTimer).mockResolvedValue(ok(entry) as never);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');

    const { result } = renderHook(() => useStartTimer(), {
      wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
    });

    result.current.mutate({ description: 'Tarefa' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['time-tracking'] }),
    );
  });
});

describe('useStopTimer', () => {
  it('para timer e invalida queries', async () => {
    const entry = { id: 'e1', endTime: '2024-01-01T10:00:00Z' };
    vi.mocked(stopTimer).mockResolvedValue(ok(entry) as never);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');

    const { result } = renderHook(() => useStopTimer(), {
      wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
    });

    result.current.mutate();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalled();
  });
});

describe('useTimeEntries', () => {
  it('lista entradas de tempo', async () => {
    vi.mocked(listTimeEntries).mockResolvedValue(
      ok({ data: [], meta: { total: 0 } }) as never,
    );

    const { result } = renderHook(() => useTimeEntries(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(listTimeEntries).toHaveBeenCalledWith(undefined);
  });
});
