import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ProposalDetailPage from './page';
import { getProposal } from '@/lib/actions/proposal/api';
import type { Proposal } from '@/lib/actions/proposal/types';

vi.mock('@/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/lib/actions/proposal/api', () => ({
  getProposal: vi.fn(),
}));

vi.mock('../components/proposal-company-field', () => ({
  ProposalCompanyField: () => null,
}));
vi.mock('../components/proposal-content-tab', () => ({
  ProposalContentTab: () => null,
}));
vi.mock('../components/proposal-commercial-tab', () => ({
  ProposalCommercialTab: () => null,
}));
vi.mock('../components/proposal-publication-tab', () => ({
  ProposalPublicationTab: () => null,
}));
vi.mock('../components/proposal-versions-tab', () => ({
  ProposalVersionsTab: () => null,
}));

function proposal(overrides: Partial<Proposal> = {}): Proposal {
  return {
    id: 'p1',
    companyId: null,
    companyName: null,
    ownerId: 'u1',
    name: 'Site novo',
    status: 'DRAFT',
    lostReason: null,
    layout: null,
    totalCents: null,
    currency: 'BRL',
    recurrence: 'ONE_TIME',
    termDays: null,
    validUntil: null,
    includedItems: [],
    optionalItems: [],
    archivedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    daysWithoutMovement: 0,
    ...overrides,
  };
}

describe('/proposal/[id] — badge de status', () => {
  it('mostra o rótulo do vocabulário, nunca o enum cru', async () => {
    vi.mocked(getProposal).mockResolvedValue({
      success: true,
      data: proposal({ status: 'DRAFT' }),
      message: '',
      status: 200,
      errors: undefined,
    });

    const result = await ProposalDetailPage({ params: Promise.resolve({ id: 'p1' }) });
    render(result);

    expect(screen.getByText('proposalStatus.DRAFT')).toBeInTheDocument();
    expect(screen.queryByText('DRAFT')).not.toBeInTheDocument();
  });
});
