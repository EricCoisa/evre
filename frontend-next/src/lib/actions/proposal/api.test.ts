import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockProposalApi = vi.hoisted(() => ({
  proposalControllerFindAll: vi.fn(),
  proposalControllerFindOne: vi.fn(),
  proposalControllerCreate: vi.fn(),
  proposalControllerUpdate: vi.fn(),
  proposalControllerRemove: vi.fn(),
  proposalControllerDuplicate: vi.fn(),
  proposalControllerUpdateLayout: vi.fn(),
  proposalControllerUpdateTerms: vi.fn(),
  proposalControllerUpdateStatus: vi.fn(),
  proposalControllerPublish: vi.fn(),
  proposalControllerReopen: vi.fn(),
  proposalControllerRevoke: vi.fn(),
  proposalControllerListVersions: vi.fn(),
  proposalControllerAcceptOffline: vi.fn(),
  proposalControllerListSends: vi.fn(),
}));

const mockCustomInstance = vi.hoisted(() => vi.fn());

vi.mock('@/lib/generated/proposal/proposal', () => ({
  getProposal: () => mockProposalApi,
}));
vi.mock('@/lib/api/orval-instance', () => ({
  customInstance: mockCustomInstance,
}));

import {
  getProposals,
  getProposal,
  createProposal,
  updateProposal,
  archiveProposal,
  duplicateProposal,
  updateProposalLayout,
  updateProposalTerms,
  updateProposalStatus,
  publishProposal,
  reopenProposal,
  revokeProposalPublication,
  listProposalVersions,
  acceptProposalOffline,
  sendProposal,
  listProposalSends,
} from './api';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getProposals', () => {
  it('lista propostas', async () => {
    mockProposalApi.proposalControllerFindAll.mockResolvedValue({ data: [], meta: { total: 0 } });

    const result = await getProposals();

    expect(result.success).toBe(true);
  });
});

describe('getProposal', () => {
  it('busca proposta por id', async () => {
    mockProposalApi.proposalControllerFindOne.mockResolvedValue({ id: 'pr1' });

    const result = await getProposal('pr1');

    expect(result.success).toBe(true);
    expect(mockProposalApi.proposalControllerFindOne).toHaveBeenCalledWith('pr1');
  });
});

describe('createProposal', () => {
  it('cria proposta', async () => {
    mockProposalApi.proposalControllerCreate.mockResolvedValue({ id: 'pr1' });

    const result = await createProposal({ name: 'Proposta 1' });

    expect(result.success).toBe(true);
  });
});

describe('updateProposal', () => {
  it('atualiza proposta', async () => {
    mockProposalApi.proposalControllerUpdate.mockResolvedValue({ id: 'pr1' });

    const result = await updateProposal('pr1', { name: 'Nova' });

    expect(result.success).toBe(true);
  });
});

describe('archiveProposal', () => {
  it('arquiva proposta', async () => {
    mockProposalApi.proposalControllerRemove.mockResolvedValue({ id: 'pr1' });

    const result = await archiveProposal('pr1');

    expect(result.success).toBe(true);
  });
});

describe('duplicateProposal', () => {
  it('duplica proposta', async () => {
    mockProposalApi.proposalControllerDuplicate.mockResolvedValue({ id: 'pr2' });

    const result = await duplicateProposal('pr1');

    expect(result.success).toBe(true);
  });
});

describe('publishProposal', () => {
  it('publica proposta', async () => {
    mockProposalApi.proposalControllerPublish.mockResolvedValue({ publicUrl: 'https://x/p/tok' });

    const result = await publishProposal('pr1');

    expect(result.success).toBe(true);
    expect(mockProposalApi.proposalControllerPublish).toHaveBeenCalledWith('pr1');
  });
});

describe('reopenProposal', () => {
  it('reabre proposta', async () => {
    mockProposalApi.proposalControllerReopen.mockResolvedValue({ id: 'pr1', status: 'DRAFT' });

    const result = await reopenProposal('pr1');

    expect(result.success).toBe(true);
  });
});

describe('revokeProposalPublication', () => {
  it('revoga publicação', async () => {
    mockProposalApi.proposalControllerRevoke.mockResolvedValue({ revoked: true });

    const result = await revokeProposalPublication('pr1');

    expect(result.success).toBe(true);
  });
});

describe('sendProposal', () => {
  it('envia proposta via customInstance', async () => {
    mockCustomInstance.mockResolvedValue({ succeeded: true, shortUrl: 'https://x' });

    const result = await sendProposal('pr1', { phone: '+5511999999999' });

    expect(result.success).toBe(true);
    expect(mockCustomInstance).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'POST' }),
    );
  });
});

describe('listProposalSends', () => {
  it('lista envios da proposta', async () => {
    mockProposalApi.proposalControllerListSends.mockResolvedValue([]);

    const result = await listProposalSends('pr1');

    expect(result.success).toBe(true);
  });
});

describe('errors', () => {
  it('propaga falha como envelope de erro', async () => {
    mockProposalApi.proposalControllerFindOne.mockRejectedValue(new Error('boom'));

    const result = await getProposal('pr1');

    expect(result.success).toBe(false);
  });
});
