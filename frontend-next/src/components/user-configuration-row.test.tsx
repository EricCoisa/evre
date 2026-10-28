import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { UserConfigurationRow } from './user-configuration-row';

const mocks = vi.hoisted(() => ({
  userRole: null as string | null,
  queryData: null as unknown,
}));

vi.mock('@/lib/actions/auth/queries', () => ({
  useMe: () => ({
    data: mocks.userRole ? { role: mocks.userRole } : null,
    isLoading: false,
    error: null,
  }),
}));

vi.mock('@/lib/actions/userConfiguration/queries', () => ({
  useUserConfiguration: () => ({ data: mocks.queryData }),
  useSetUserConfiguration: () => ({ mutateAsync: vi.fn().mockResolvedValue({ status: true }), isPending: false }),
}));

const syncOnCapabilitiesChangeSpy = vi.fn();
vi.mock('@/lib/actions/capability/queries', () => ({
  useSyncOnCapabilitiesChange: (queryKey: unknown) => syncOnCapabilitiesChangeSpy(queryKey),
}));

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(ui, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
}

const field = (overrides: Record<string, unknown> = {}) => ({
  id: 'cfg-1',
  labelKey: 'USER_NOTIFICATIONS_EMAIL',
  valueType: 'STRING',
  value: 'valor-atual',
  ...overrides,
});

describe('UserConfigurationRow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.userRole = null;
    mocks.queryData = field();
  });

  it('renderiza título, descrição e o controle dentro do mesmo ConfigRow', () => {
    renderWithClient(
      <UserConfigurationRow labelKey="USER_NOTIFICATIONS_EMAIL" title="Notificações por email" description="Receba alertas por email" />,
    );

    expect(screen.getByText('Notificações por email')).toBeInTheDocument();
    expect(screen.getByText('Receba alertas por email')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('usa labelKey como id do container, para deep-link por âncora', () => {
    renderWithClient(<UserConfigurationRow labelKey="USER_NOTIFICATIONS_EMAIL" title="Notificações" />);
    expect(document.getElementById('USER_NOTIFICATIONS_EMAIL')).not.toBeNull();
  });

  it('requirements.hidden: a linha inteira não renderiza nada', () => {
    mocks.queryData = field({ requirements: { hidden: true } });
    renderWithClient(<UserConfigurationRow labelKey="USER_NOTIFICATIONS_EMAIL" title="Notificações" />);
    expect(screen.queryByText('Notificações')).toBeNull();
  });

  it('disableOnRequirement é false (fixo): requisito indisponível NÃO desabilita o controle do usuário', () => {
    mocks.queryData = field({ requirements: { disabled: true, capability: 'EMAIL' } });
    renderWithClient(<UserConfigurationRow labelKey="USER_NOTIFICATIONS_EMAIL" title="Notificações" />);

    const input = screen.getByRole('textbox');
    expect(input).not.toBeDisabled();
  });

  it('admin vê o aviso quando o requisito está indisponível (campo boolean, onde o aviso é renderizado)', () => {
    mocks.userRole = 'ADMIN';
    mocks.queryData = field({
      valueType: 'BOOLEAN',
      value: 'true',
      requirements: { disabled: true, capability: 'EMAIL', reason: 'Email fora do ar' },
    });
    renderWithClient(<UserConfigurationRow labelKey="USER_NOTIFICATIONS_EMAIL" title="Notificações" />);

    expect(screen.getByRole('switch')).not.toBeDisabled();
    expect(screen.getAllByRole('button', { name: 'Email fora do ar' }).length).toBeGreaterThan(0);
  });

  it('usuário comum (role: USER) não vê o aviso mesmo com requisito indisponível', () => {
    mocks.userRole = 'USER';
    mocks.queryData = field({
      valueType: 'BOOLEAN',
      value: 'true',
      requirements: { disabled: true, capability: 'EMAIL', reason: 'Email fora do ar' },
    });
    renderWithClient(<UserConfigurationRow labelKey="USER_NOTIFICATIONS_EMAIL" title="Notificações" />);

    expect(screen.queryByRole('button', { name: 'Email fora do ar' })).toBeNull();
  });

  it('chama useSyncOnCapabilitiesChange com a query key da própria chave', () => {
    renderWithClient(<UserConfigurationRow labelKey="USER_NOTIFICATIONS_EMAIL" title="Notificações" />);
    expect(syncOnCapabilitiesChangeSpy).toHaveBeenCalledWith(['user-configuration', 'USER_NOTIFICATIONS_EMAIL']);
  });
});
