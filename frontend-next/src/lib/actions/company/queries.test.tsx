import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

vi.mock('./api', () => ({
  getCompanies: vi.fn(),
  getCompany: vi.fn(),
  createCompany: vi.fn(),
  updateCompany: vi.fn(),
  archiveCompany: vi.fn(),
  getCompanyContacts: vi.fn(),
  createCompanyContact: vi.fn(),
  updateCompanyContact: vi.fn(),
  archiveCompanyContact: vi.fn(),
  getCompanyMembers: vi.fn(),
  getCompanyInvites: vi.fn(),
  addCompanyMember: vi.fn(),
  inviteCompanyMember: vi.fn(),
  updateCompanyMember: vi.fn(),
  removeCompanyMember: vi.fn(),
}));
vi.mock('@/lib/api/collector', () => ({
  Collector: (fn: () => unknown) => fn,
  Alive: (fn: () => unknown) => fn,
}));
vi.mock('@/contexts/appProvider', () => ({
  useApp: () => ({ emulateError: false }),
}));

import { getCompanies, getCompany, createCompany } from './api';
import { useCompanies, useCompany, useCreateCompany } from './queries';

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

describe('useCompanies', () => {
  it('lista empresas', async () => {
    vi.mocked(getCompanies).mockResolvedValue(ok([{ id: 'c1' }]) as never);

    const { result } = renderHook(() => useCompanies(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getCompanies).toHaveBeenCalledWith(undefined);
  });
});

describe('useCompany', () => {
  it('busca empresa quando id existe', async () => {
    vi.mocked(getCompany).mockResolvedValue(ok({ id: 'c1', name: 'ACME' }) as never);

    const { result } = renderHook(() => useCompany('c1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getCompany).toHaveBeenCalledWith('c1');
  });

  it('não busca quando id é nulo (enabled: false)', () => {
    const { result } = renderHook(() => useCompany(null), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
    expect(getCompany).not.toHaveBeenCalled();
  });
});

describe('useCreateCompany', () => {
  it('cria empresa e invalida query de empresas', async () => {
    vi.mocked(createCompany).mockResolvedValue(ok({ id: 'c1' }) as never);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');

    const { result } = renderHook(() => useCreateCompany(), {
      wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
    });

    result.current.mutate({ name: 'ACME' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['companies'] });
  });
});
