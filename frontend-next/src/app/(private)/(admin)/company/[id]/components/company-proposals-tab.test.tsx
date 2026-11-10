import { describe, expect, it, vi } from 'vitest';
import { render } from '@/test-utils';
import { CompanyProposalsTab } from './company-proposals-tab';

vi.mock('@/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mocks = vi.hoisted(() => ({
  useProposals: vi.fn(() => ({ data: [], error: null })),
}));

vi.mock('@/lib/actions/proposal/queries', () => ({
  useProposals: mocks.useProposals,
  useCreateProposal: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useArchiveProposal: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDuplicateProposal: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('@/lib/actions/company/queries', () => ({
  useCompanies: () => ({ data: [] }),
}));

describe('CompanyProposalsTab', () => {
  it('busca as propostas filtradas por companyId, não a lista inteira', () => {
    render(<CompanyProposalsTab companyId="c1" />);

    expect(mocks.useProposals).toHaveBeenCalledWith(
      expect.objectContaining({ filter: JSON.stringify({ companyId: 'c1' }) }),
    );
  });
});
