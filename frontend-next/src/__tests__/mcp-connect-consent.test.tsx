import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockApprove = vi.fn();
const mockRouterPush = vi.fn();
let requestState: {
  data: unknown;
  error: unknown;
  isPending: boolean;
} = { data: null, error: null, isPending: true };

vi.mock('@/lib/actions/mcp/queries', () => ({
  useAuthorizationRequest: () => requestState,
  useApproveAuthorization: () => ({ mutateAsync: mockApprove, isPending: false }),
}));

const searchParams = new URLSearchParams();
vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParams,
  useRouter: () => ({ push: mockRouterPush }),
}));

// i18n fora do teste: o que importa aqui é o fluxo, não a tradução.
vi.mock('@/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import ConnectPage from '@/app/(private)/profile/connect/page';

const REQUEST = {
  clientId: 'c1',
  clientName: 'Claude Desktop',
  redirectUri: 'https://claude.ai/api/mcp/auth_callback',
  requestedScopes: ['users:read'],
  availableScopes: ['users:read', 'users:write', 'feature-flags:write'],
};

/** Testa quais scopes saem no approve da tela de consentimento OAuth. */
describe('Tela de consentimento do conector MCP', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchParams.set('req', 'signed-request');
    requestState = { data: REQUEST, error: null, isPending: false };
    mockApprove.mockResolvedValue({ redirectTo: 'https://claude.ai/cb?code=abc' });
    // jsdom não implementa navegação; só precisamos observar o destino.
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { href: '' },
    });
  });

  it('pré-marca exatamente os scopes que o cliente pediu', async () => {
    render(<ConnectPage />);

    await waitFor(() =>
      expect(screen.getByLabelText('scope_users_read')).toBeChecked(),
    );
    expect(screen.getByLabelText('scope_users_write')).not.toBeChecked();
    expect(screen.getByLabelText('scope_feature_flags_write')).not.toBeChecked();
  });

  it('aprova com os scopes marcados e mostra confirmação antes de voltar ao cliente', async () => {
    render(<ConnectPage />);
    await waitFor(() =>
      expect(screen.getByLabelText('scope_users_read')).toBeChecked(),
    );

    await userEvent.click(screen.getByLabelText('scope_feature_flags_write'));
    await userEvent.click(screen.getByRole('button', { name: 'connectApprove' }));

    expect(mockApprove).toHaveBeenCalledWith({
      req: 'signed-request',
      scopes: ['users:read', 'feature-flags:write'],
    });
    expect(await screen.findByText('connectSuccessTitle')).toBeInTheDocument();
    expect(window.location.href).toBe('');
    await userEvent.click(
      screen.getByRole('button', { name: 'connectSuccessContinue' }),
    );
    await waitFor(() =>
      expect(window.location.href).toBe('https://claude.ai/cb?code=abc'),
    );
  });

  it('cancelar volta à aba de conectores do perfil', async () => {
    render(<ConnectPage />);
    await userEvent.click(screen.getByRole('button', { name: 'connectDeny' }));

    expect(mockRouterPush).toHaveBeenCalledWith('/profile?tab=connectors');
    expect(mockApprove).not.toHaveBeenCalled();
  });

  it('desmarcar antes de aprovar remove o scope do consentimento', async () => {
    render(<ConnectPage />);
    await waitFor(() =>
      expect(screen.getByLabelText('scope_users_read')).toBeChecked(),
    );

    await userEvent.click(screen.getByLabelText('scope_users_read'));
    await userEvent.click(screen.getByRole('button', { name: 'connectApprove' }));

    expect(mockApprove).toHaveBeenCalledWith({
      req: 'signed-request',
      scopes: [],
    });
  });

  it('approve que falha não navega para lugar nenhum', async () => {
    mockApprove.mockRejectedValue(new Error('boom'));
    render(<ConnectPage />);
    await waitFor(() =>
      expect(screen.getByLabelText('scope_users_read')).toBeChecked(),
    );

    await userEvent.click(screen.getByRole('button', { name: 'connectApprove' }));

    await waitFor(() => expect(mockApprove).toHaveBeenCalled());
    expect(window.location.href).toBe('');
  });

  it('sem `req` na URL não renderiza consentimento nenhum', () => {
    searchParams.delete('req');
    render(<ConnectPage />);
    expect(screen.queryByRole('button', { name: 'connectApprove' })).toBeNull();
  });

  it('pedido expirado/inválido não renderiza consentimento', () => {
    requestState = { data: null, error: new Error('expired'), isPending: false };
    render(<ConnectPage />);
    expect(screen.queryByRole('button', { name: 'connectApprove' })).toBeNull();
  });
});
