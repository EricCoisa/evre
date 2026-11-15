import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockProposalPublicApi = vi.hoisted(() => ({
  proposalPublicControllerGetPublic: vi.fn(),
  proposalPublicControllerRequestRenewal: vi.fn(),
  proposalPublicControllerAccept: vi.fn(),
}));

vi.mock('@/lib/generated/proposal-public/proposal-public', () => ({
  getProposalPublic: () => mockProposalPublicApi,
}));

import {
  getPublicProposal,
  requestProposalRenewal,
  acceptPublicProposal,
} from './api';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getPublicProposal', () => {
  it('busca proposta pública por token', async () => {
    mockProposalPublicApi.proposalPublicControllerGetPublic.mockResolvedValue({
      id: 'pr1',
      name: 'Proposta',
    });

    const result = await getPublicProposal('tok123');

    expect(result.success).toBe(true);
    expect(mockProposalPublicApi.proposalPublicControllerGetPublic).toHaveBeenCalledWith('tok123');
  });

  it('propaga falha como envelope de erro', async () => {
    mockProposalPublicApi.proposalPublicControllerGetPublic.mockRejectedValue(new Error('boom'));

    const result = await getPublicProposal('tok123');

    expect(result.success).toBe(false);
  });
});

describe('requestProposalRenewal', () => {
  it('solicita renovação pelo token', async () => {
    mockProposalPublicApi.proposalPublicControllerRequestRenewal.mockResolvedValue(undefined);

    const result = await requestProposalRenewal('tok123');

    expect(result.success).toBe(true);
    expect(mockProposalPublicApi.proposalPublicControllerRequestRenewal).toHaveBeenCalledWith('tok123');
  });
});

describe('acceptPublicProposal', () => {
  it('aceita proposta pública com dados de aceitação', async () => {
    mockProposalPublicApi.proposalPublicControllerAccept.mockResolvedValue({
      acceptedAt: new Date().toISOString(),
    });

    const result = await acceptPublicProposal('tok123', { name: 'João', acceptTerms: true });

    expect(result.success).toBe(true);
    expect(mockProposalPublicApi.proposalPublicControllerAccept).toHaveBeenCalledWith('tok123', {
      name: 'João',
      acceptTerms: true,
    });
  });
});
