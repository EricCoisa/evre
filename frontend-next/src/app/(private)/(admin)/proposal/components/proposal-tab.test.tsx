import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@/test-utils';
import { ProposalTab } from './proposal-tab';
import type { Proposal } from '@/lib/actions/proposal/types';

vi.mock('@/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mocks = vi.hoisted(() => ({
  proposals: [] as Proposal[],
  duplicate: vi.fn(),
  archive: vi.fn(),
}));

vi.mock('@/lib/actions/proposal/queries', () => ({
  useProposals: () => ({ data: mocks.proposals, error: null }),
  useCreateProposal: () => ({ mutateAsync: vi.fn() }),
  useUpdateProposal: () => ({ mutateAsync: vi.fn() }),
  useArchiveProposal: () => ({ mutate: mocks.archive, mutateAsync: mocks.archive }),
  useDuplicateProposal: () => ({ mutate: mocks.duplicate, mutateAsync: mocks.duplicate }),
}));

vi.mock('@/lib/actions/company/queries', () => ({
  useCompanys: () => ({ data: [] }),
  useCreateCompany: () => ({ mutateAsync: vi.fn() }),
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

describe('ProposalTab', () => {
  it('duplicar na linha chama a mutation de duplicar (não arquivar/criar) com o id certo', () => {
    mocks.proposals = [proposal({ id: 'p1', name: 'Site novo' })];

    render(<ProposalTab />);
    fireEvent.click(screen.getByRole('button', { name: 'duplicateTooltip' }));

    expect(mocks.duplicate).toHaveBeenCalledWith('p1');
    expect(mocks.archive).not.toHaveBeenCalled();
  });
});
