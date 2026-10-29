import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@/test-utils';
import PublicProposalPage from './page';
import { getPublicProposal } from '@/lib/actions/proposal-public/api';
import {
  getAppNameConfiguration,
  getAppTaglineConfiguration,
} from '@/lib/actions/systemConfiguration/api';
import type { SystemConfiguration } from '@/lib/actions/systemConfiguration/types';
import type { ApiResponse } from '@/lib/api/api';

vi.mock('@/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/lib/actions/proposal-public/api', () => ({
  getPublicProposal: vi.fn(),
  requestProposalRenewal: vi.fn(),
}));

vi.mock('@/lib/actions/systemConfiguration/api', () => ({
  getAppNameConfiguration: vi.fn(),
  getAppTaglineConfiguration: vi.fn(),
}));

function errorResponse(status: number, errors?: unknown) {
  return { success: false, data: null, message: 'erro', status, errors };
}

// Valor de mock deliberadamente diferente de "EVRE": prova que o header lê da config
// (prop), não de um literal escrito no componente.
function brandConfig(value: string): ApiResponse<SystemConfiguration<string>> {
  return {
    success: true,
    data: {
      id: 'cfg-1',
      labelKey: 'SYSTEM_APP_NAME',
      valueType: 'STRING',
      value,
      updatedAt: '2026-01-01T00:00:00.000Z',
      secret: false,
      blocked: false,
    },
    message: '',
    status: 200,
  };
}

const MOCK_APP_NAME = 'Oficina Pública Ltda';
const MOCK_APP_TAGLINE = 'Consultoria sob medida';

describe('/p/[token] — header da marca vem da config em qualquer estado', () => {
  beforeEach(() => {
    vi.mocked(getAppNameConfiguration).mockResolvedValue(brandConfig(MOCK_APP_NAME));
    vi.mocked(getAppTaglineConfiguration).mockResolvedValue(brandConfig(MOCK_APP_TAGLINE));
  });

  it('REVOKED mostra o texto de revogada, sem botão de renovação e sem valor — com o header da marca', async () => {
    vi.mocked(getPublicProposal).mockResolvedValue(
      errorResponse(410, { reason: 'REVOKED' }),
    );

    const result = await PublicProposalPage({
      params: Promise.resolve({ token: 'tok-revoked' }),
    });
    render(result);

    expect(screen.getByText(MOCK_APP_NAME)).toBeInTheDocument();
    expect(screen.getByText(MOCK_APP_TAGLINE)).toBeInTheDocument();
    expect(screen.getByText('publicRevokedMessage')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'publicRenewRequest' })).not.toBeInTheDocument();
    expect(screen.queryByText(/R\$/)).not.toBeInTheDocument();
  });

  it('EXPIRED mostra o texto de expirada + botão de pedir renovação, sem valor — com o header da marca', async () => {
    vi.mocked(getPublicProposal).mockResolvedValue(
      errorResponse(410, { reason: 'EXPIRED' }),
    );

    const result = await PublicProposalPage({
      params: Promise.resolve({ token: 'tok-expired' }),
    });
    render(result);

    expect(screen.getByText(MOCK_APP_NAME)).toBeInTheDocument();
    expect(screen.getByText('publicExpiredMessage')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'publicRenewRequest' })).toBeInTheDocument();
    expect(screen.queryByText(/R\$/)).not.toBeInTheDocument();
  });

  it('token inexistente cai no genérico — não distingue de revogada, mas mostra o header da marca', async () => {
    vi.mocked(getPublicProposal).mockResolvedValue(errorResponse(404));

    const result = await PublicProposalPage({
      params: Promise.resolve({ token: 'tok-not-found' }),
    });
    render(result);

    expect(screen.getByText(MOCK_APP_NAME)).toBeInTheDocument();
    expect(screen.queryByText('publicRevokedMessage')).not.toBeInTheDocument();
    expect(screen.queryByText('publicExpiredMessage')).not.toBeInTheDocument();
  });
});
