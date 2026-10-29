import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const mocks = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock('./api', () => ({
  updateProposalLayout: vi.fn(),
}));
vi.mock('@/contexts/appProvider', () => ({ useApp: vi.fn() }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));

import { updateProposalLayout } from './api';
import { useApp } from '@/contexts/appProvider';
import { useUpdateProposalLayout } from './queries';

function ok<T>(data: T) {
  return { success: true, data, message: '', status: 200 } as const;
}

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { wrapper };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useApp).mockReturnValue({ emulateError: false } as never);
});

describe('useUpdateProposalLayout', () => {
  it('salva o layout e chama router.refresh() no sucesso — é isso que refaz o RSC de detalhe', async () => {
    vi.mocked(updateProposalLayout).mockResolvedValue(ok({ id: 'p1' }) as never);
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useUpdateProposalLayout(), { wrapper });
    result.current.mutate({ id: 'p1', data: { layout: {} as never } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(updateProposalLayout).toHaveBeenCalledWith('p1', { layout: {} });
    expect(mocks.refresh).toHaveBeenCalled();
  });
});
