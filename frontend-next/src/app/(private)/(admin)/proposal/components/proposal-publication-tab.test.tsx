import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@/test-utils';
import { ProposalPublicationTab } from './proposal-publication-tab';
import type { Proposal } from '@/lib/actions/proposal/types';

vi.mock('@/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/components/capability-gate', () => ({
  CapabilityGate: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/lib/actions/company/queries', () => ({
  useCompanyContacts: () => ({ data: [] }),
}));

vi.mock('@/lib/actions/proposal/queries', () => ({
  useAcceptProposalOffline: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useProposalSends: () => ({
    data: [
      {
        id: 's1',
        versionId: 'v1',
        channel: 'WHATSAPP',
        toPhone: '5511999999999',
        toEmail: null,
        succeeded: true,
        detail: null,
        sentById: null,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ],
  }),
  useProposalVersions: () => ({ data: [] }),
  usePublishProposal: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
  useReopenProposal: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRevokeProposalPublication: () => ({ mutate: vi.fn(), isPending: false }),
  useSendProposal: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateProposalStatus: () => ({ mutateAsync: vi.fn(), isPending: false }),
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

describe('ProposalPublicationTab — histórico de envios', () => {
  it('mostra o rótulo do canal, nunca o enum cru', () => {
    render(<ProposalPublicationTab proposal={proposal()} />);

    expect(screen.getByText('sendChannel.WHATSAPP')).toBeInTheDocument();
    expect(screen.queryByText('WHATSAPP')).not.toBeInTheDocument();
  });
});
