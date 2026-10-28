import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import PublicProposalPage from './page';
import { getPublicProposal } from '@/lib/actions/proposal-public/api';

vi.mock('@/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/lib/actions/proposal-public/api', () => ({
  getPublicProposal: vi.fn(),
  requestProposalRenewal: vi.fn(),
}));

function errorResponse(status: number, errors?: unknown) {
  return { success: false, data: null, message: 'erro', status, errors };
}

describe('/p/[token] — estados de indisponibilidade não vazam valor nem conteúdo', () => {
  it('REVOKED mostra o texto de revogada, sem botão de renovação e sem valor', async () => {
    vi.mocked(getPublicProposal).mockResolvedValue(
      errorResponse(410, { reason: 'REVOKED' }),
    );

    const result = await PublicProposalPage({
      params: Promise.resolve({ token: 'tok-revoked' }),
    });
    render(result);

    expect(screen.getByText('publicRevokedMessage')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'publicRenewRequest' })).not.toBeInTheDocument();
    expect(screen.queryByText(/R\$/)).not.toBeInTheDocument();
  });

  it('EXPIRED mostra o texto de expirada + botão de pedir renovação, sem valor', async () => {
    vi.mocked(getPublicProposal).mockResolvedValue(
      errorResponse(410, { reason: 'EXPIRED' }),
    );

    const result = await PublicProposalPage({
      params: Promise.resolve({ token: 'tok-expired' }),
    });
    render(result);

    expect(screen.getByText('publicExpiredMessage')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'publicRenewRequest' })).toBeInTheDocument();
    expect(screen.queryByText(/R\$/)).not.toBeInTheDocument();
  });

  it('token inexistente cai no genérico — não distingue de revogada', async () => {
    vi.mocked(getPublicProposal).mockResolvedValue(errorResponse(404));

    const result = await PublicProposalPage({
      params: Promise.resolve({ token: 'tok-not-found' }),
    });
    render(result);

    expect(screen.queryByText('publicRevokedMessage')).not.toBeInTheDocument();
    expect(screen.queryByText('publicExpiredMessage')).not.toBeInTheDocument();
  });
});
