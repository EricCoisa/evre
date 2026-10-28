import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { UserConfiguration } from './user-configuration';
import { snapshotScreen } from '@/components/agent/screen-registry';

const mockMutateAsync = vi.fn();

vi.mock('@/lib/actions/userConfiguration/queries', () => ({
  useUserConfiguration: () => mocks.queryResult,
  useSetUserConfiguration: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mocks = vi.hoisted(() => ({
  queryResult: { data: null as unknown },
}));

import { toast } from 'sonner';
import i18n from '../../i18n';

/** Os botões/mensagens usam `title`/texto traduzidos pelo i18n real — não fixe a cópia no teste. */
const t = (key: string) => i18n.t(key, { ns: 'common' });

function renderWithClient(ui: React.ReactElement, client = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  return {
    client,
    ...render(ui, {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    }),
  };
}

const field = (overrides: Record<string, unknown> = {}) => ({
  id: 'cfg-1',
  labelKey: 'USER_NOTIFICATIONS_EMAIL',
  valueType: 'STRING',
  value: 'valor-atual',
  ...overrides,
});

describe('UserConfiguration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMutateAsync.mockResolvedValue({ status: true });
    mocks.queryResult = { data: field() };
  });

  it('renderiza a mensagem de not_found quando a query ainda não tem dado', () => {
    mocks.queryResult = { data: null };
    renderWithClient(<UserConfiguration labelKey="USER_NOTIFICATIONS_EMAIL" />);
    expect(screen.getByText(new RegExp(t('not_found')))).toBeInTheDocument();
  });

  it('mapeia isSecret do dado para secret no BaseConfiguration (mascara o valor)', () => {
    mocks.queryResult = { data: field({ isSecret: true, value: 'topsecret' }) };
    renderWithClient(<UserConfiguration labelKey="USER_NOTIFICATIONS_EMAIL" />);

    const input = document.getElementById('USER_NOTIFICATIONS_EMAIL') as HTMLInputElement;
    expect(input.type).toBe('password');
    expect(input.value).toBe('****');
  });

  it('registra o item na tela (screen-registry) enquanto montado', () => {
    const { unmount } = renderWithClient(<UserConfiguration labelKey="USER_NOTIFICATIONS_EMAIL" />);
    expect(snapshotScreen()).toContainEqual({
      kind: 'config',
      source: 'user-configuration',
      detail: 'USER_NOTIFICATIONS_EMAIL',
    });
    unmount();
    expect(snapshotScreen()).not.toContainEqual({
      kind: 'config',
      source: 'user-configuration',
      detail: 'USER_NOTIFICATIONS_EMAIL',
    });
  });

  it('showMessage omitido: NÃO mostra toast de sucesso mesmo com resultado truthy (showMessage cru, não o default aplicado ao BaseConfiguration)', async () => {
    renderWithClient(<UserConfiguration labelKey="USER_NOTIFICATIONS_EMAIL" manualSave />);
    const input = screen.getByRole('textbox');
    const user = userEvent.setup();
    await user.clear(input);
    await user.type(input, 'novo valor');
    await user.click(screen.getByTitle(t('confirm')));

    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalled());
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('showMessage=true e resultado truthy: mostra toast de sucesso', async () => {
    renderWithClient(<UserConfiguration labelKey="USER_NOTIFICATIONS_EMAIL" manualSave showMessage />);
    const input = screen.getByRole('textbox');
    const user = userEvent.setup();
    await user.clear(input);
    await user.type(input, 'novo valor');
    await user.click(screen.getByTitle(t('confirm')));

    await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1));
  });

  it('showMessage=true mas resultado falsy: NÃO mostra toast', async () => {
    mockMutateAsync.mockResolvedValue(null);
    renderWithClient(<UserConfiguration labelKey="USER_NOTIFICATIONS_EMAIL" manualSave showMessage />);
    const input = screen.getByRole('textbox');
    const user = userEvent.setup();
    await user.clear(input);
    await user.type(input, 'novo valor');
    await user.click(screen.getByTitle(t('confirm')));

    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalled());
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('invalida sempre ["capabilities"] e cada chave de invalidateKeys após salvar', async () => {
    const { client } = renderWithClient(
      <UserConfiguration labelKey="USER_NOTIFICATIONS_EMAIL" manualSave invalidateKeys={[['feature-a'], ['feature-b']]} />,
    );
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');

    const input = screen.getByRole('textbox');
    const user = userEvent.setup();
    await user.clear(input);
    await user.type(input, 'novo valor');
    await user.click(screen.getByTitle(t('confirm')));

    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalled());
    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['capabilities'] }));
      expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['feature-a'] }));
      expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['feature-b'] }));
    });
  });

  it('envia o valor atualizado (id + value) para a mutação ao confirmar', async () => {
    renderWithClient(<UserConfiguration labelKey="USER_NOTIFICATIONS_EMAIL" manualSave />);
    const input = screen.getByRole('textbox');
    const user = userEvent.setup();
    await user.clear(input);
    await user.type(input, 'valor-novo');
    await user.click(screen.getByTitle(t('confirm')));

    await waitFor(() =>
      expect(mockMutateAsync).toHaveBeenCalledWith({
        userConfiguration: expect.objectContaining({ id: 'cfg-1', value: 'valor-novo' }),
      }),
    );
  });

  it('repassa disabled/warning/warningReason/fixPath ao BaseConfiguration (campo boolean, onde o aviso é de fato renderizado)', () => {
    // Nota: warning/warningReason/fixPath só produzem UI para campos BOOLEAN — o
    // ConfigFieldDispatcher (base-configuration.tsx) não repassa isWarn/warningReason/fixPath
    // para STRING/DATE/NUMBER, então testamos o encaminhamento aqui com um campo boolean.
    mocks.queryResult = { data: field({ valueType: 'BOOLEAN', value: 'true' }) };
    renderWithClient(
      <UserConfiguration
        labelKey="USER_NOTIFICATIONS_EMAIL"
        disabled
        warning
        warningReason="Motivo técnico"
        fixPath="/settings?tab=x"
      />,
    );
    expect(screen.getByRole('switch')).toBeDisabled();
    // BooleanToggleField renderiza o aviso tanto junto ao label quanto junto ao chip de estado.
    expect(screen.getAllByRole('button', { name: 'Motivo técnico' }).length).toBeGreaterThan(0);
  });
});
