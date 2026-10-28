import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockMutateAsync = vi.fn().mockResolvedValue({ status: true });

const mocks = vi.hoisted(() => ({
  configData: null as unknown,
}));

vi.mock('@/lib/actions/systemConfiguration/queries', () => ({
  useConfiguration: () => ({
    data: mocks.configData,
    error: null,
    isLoading: false,
  }),
  useUpdateConfiguration: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { toast } from 'sonner';
import { SystemConfiguration } from '@/components/system-configuration';

const booleanField = {
  id: 'cfg-1',
  labelKey: 'SYSTEM_AGENT_OWN_KEY',
  valueType: 'BOOLEAN',
  value: 'false',
};

describe('SystemConfiguration — invalidateKeys', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMutateAsync.mockResolvedValue({ status: true });
    mocks.configData = booleanField;
  });

  it('refetcha query sem observador (tela desmontada)', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, refetchOnMount: false } },
    });
    const queryFn = vi.fn().mockResolvedValue({ models: ['claude-opus-4'], default: 'claude-opus-4' });

    // Modelos do provider ativo, buscados enquanto o chat estava aberto e agora sem
    // observador nenhum — exatamente o estado de quem fechou a janela do agente.
    await client.fetchQuery({ queryKey: ['ai', 'models'], queryFn });
    expect(queryFn).toHaveBeenCalledTimes(1);

    render(
      <SystemConfiguration
        labelKey="SYSTEM_AGENT_OWN_KEY"
        invalidateKeys={[['ai']]}
      />,
      {
        wrapper: ({ children }: { children: ReactNode }) => (
          <QueryClientProvider client={client}>{children}</QueryClientProvider>
        ),
      },
    );

    await userEvent.click(screen.getByRole('switch'));

    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalled());
    await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(2));
  });

  it('showMessage=true e resultado truthy: mostra toast de sucesso', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <SystemConfiguration labelKey="SYSTEM_AGENT_OWN_KEY" showMessage />,
      {
        wrapper: ({ children }: { children: ReactNode }) => (
          <QueryClientProvider client={client}>{children}</QueryClientProvider>
        ),
      },
    );

    await userEvent.click(screen.getByRole('switch'));

    await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1));
  });

  it('data.blocked: handleUpdate não faz nada (não chama a mutação)', async () => {
    mocks.configData = { ...booleanField, blocked: true };
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <SystemConfiguration labelKey="SYSTEM_AGENT_OWN_KEY" />,
      {
        wrapper: ({ children }: { children: ReactNode }) => (
          <QueryClientProvider client={client}>{children}</QueryClientProvider>
        ),
      },
    );

    // Campo bloqueado pelo sistema: o switch já renderiza desabilitado.
    expect(screen.getByRole('switch')).toBeDisabled();
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });
});
