import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@/test-utils';
import { ProposalContentTab } from './proposal-content-tab';
import type { Proposal } from '@/lib/actions/proposal/types';

vi.mock('@/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/lib/actions/proposal/queries', () => ({
  useUpdateProposalLayout: () => ({ mutate: vi.fn(), isPending: false }),
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

describe('ProposalContentTab', () => {
  it('editor desabilitado e motivo visível quando status não é DRAFT', () => {
    render(<ProposalContentTab proposal={proposal({ status: 'SENT' })} />);

    expect(screen.getByRole('button', { name: 'editContent' })).toBeDisabled();
    expect(screen.getByText('contentLockedTitle')).toBeInTheDocument();
  });

  it('editor habilitado quando status é DRAFT, sem o aviso de bloqueio', () => {
    render(<ProposalContentTab proposal={proposal({ status: 'DRAFT' })} />);

    expect(screen.getByRole('button', { name: 'editContent' })).toBeEnabled();
    expect(screen.queryByText('contentLockedTitle')).not.toBeInTheDocument();
  });
});
