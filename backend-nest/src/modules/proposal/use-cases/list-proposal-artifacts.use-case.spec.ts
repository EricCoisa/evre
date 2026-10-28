import { Test } from '@nestjs/testing';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../../../prisma/prisma.service';
import { ResourceAccessService } from 'src/common/infrastructure/resource-access/resource-access.service';
import type { AuthenticatedUser } from 'src/common/types/auth.types';
import { ListProposalArtifactsUseCase } from './list-proposal-artifacts.use-case';
import { FindOneProposalUseCase } from './find-one.use-case';

const admin: AuthenticatedUser = {
  id: 'admin-1',
  email: 'admin@example.com',
  roleId: 'role-admin',
  roleName: 'ADMIN',
};

const proposalRow = {
  id: 'proposal-1',
  companyId: null as string | null,
  ownerId: 'user-1',
  name: 'Exemplo',
  status: 'DRAFT',
};

const mockPrisma = {
  proposal: { findUnique: vi.fn() },
  proposalArtifact: { findMany: vi.fn() },
};

const mockI18n = { t: vi.fn().mockReturnValue('mensagem') };
const mockResourceAccess = { assertCanRead: vi.fn() };

describe('ListProposalArtifactsUseCase', () => {
  let useCase: ListProposalArtifactsUseCase;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ListProposalArtifactsUseCase,
        FindOneProposalUseCase,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: I18nService, useValue: mockI18n },
        { provide: ResourceAccessService, useValue: mockResourceAccess },
      ],
    }).compile();
    useCase = module.get(ListProposalArtifactsUseCase);

    vi.clearAllMocks();
    mockPrisma.proposal.findUnique.mockResolvedValue({ ...proposalRow });
    mockResourceAccess.assertCanRead.mockResolvedValue(undefined);
    mockPrisma.proposalArtifact.findMany.mockResolvedValue([]);
  });

  it('lista só os artefatos ativos (não arquivados) da proposta', async () => {
    await useCase.execute('proposal-1', admin);

    expect(mockPrisma.proposalArtifact.findMany).toHaveBeenCalledWith({
      where: { proposalId: 'proposal-1', archivedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('nega antes de consultar quem não alcança a proposta', async () => {
    mockResourceAccess.assertCanRead.mockRejectedValue(new Error('sem acesso'));

    await expect(useCase.execute('proposal-1', admin)).rejects.toThrow();
    expect(mockPrisma.proposalArtifact.findMany).not.toHaveBeenCalled();
  });
});
