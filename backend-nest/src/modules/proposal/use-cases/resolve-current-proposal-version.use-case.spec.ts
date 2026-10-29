import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from 'src/prisma/prisma.service';
import { ResourceAccessService } from 'src/common/infrastructure/resource-access/resource-access.service';
import type { AuthenticatedUser } from 'src/common/types/auth.types';
import { ResolveCurrentProposalVersionUseCase } from './resolve-current-proposal-version.use-case';
import { FindOneProposalUseCase } from './find-one.use-case';

const admin: AuthenticatedUser = {
  id: 'admin-1',
  email: 'admin@example.com',
  roleId: 'role-admin',
  roleName: 'ADMIN',
};

const row = {
  id: 'id-1',
  companyId: null as string | null,
  ownerId: 'user-1',
  name: 'Exemplo',
  status: 'SENT',
};

const mockPrisma = {
  proposal: { findUnique: vi.fn() },
  proposalVersion: { findFirst: vi.fn() },
};

const mockI18n = { t: vi.fn((key: string) => key) };
const mockResourceAccess = { assertCanRead: vi.fn() };

describe('ResolveCurrentProposalVersionUseCase', () => {
  let useCase: ResolveCurrentProposalVersionUseCase;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ResolveCurrentProposalVersionUseCase,
        FindOneProposalUseCase,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: I18nService, useValue: mockI18n },
        { provide: ResourceAccessService, useValue: mockResourceAccess },
      ],
    }).compile();
    useCase = module.get(ResolveCurrentProposalVersionUseCase);

    vi.clearAllMocks();
    mockPrisma.proposal.findUnique.mockResolvedValue({ ...row });
    mockResourceAccess.assertCanRead.mockResolvedValue(undefined);
  });

  it('resolve a versão vigente (mais recente) depois de autorizar via FindOneProposalUseCase', async () => {
    mockPrisma.proposalVersion.findFirst.mockResolvedValue({
      id: 'version-2',
    });

    const result = await useCase.execute('id-1', admin);

    expect(mockResourceAccess.assertCanRead).toHaveBeenCalled();
    expect(mockPrisma.proposalVersion.findFirst).toHaveBeenCalledWith({
      where: { proposalId: 'id-1' },
      orderBy: { version: 'desc' },
      select: { id: true },
    });
    expect(result).toEqual({ id: 'version-2' });
  });

  it('recusa quando a proposta não tem nenhuma versão publicada', async () => {
    mockPrisma.proposalVersion.findFirst.mockResolvedValue(null);

    await expect(useCase.execute('id-1', admin)).rejects.toThrow(
      NotFoundException,
    );
    expect(mockI18n.t).toHaveBeenCalledWith('proposal.version_not_found');
  });
});
