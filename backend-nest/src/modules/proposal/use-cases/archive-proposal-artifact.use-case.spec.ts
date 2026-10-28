import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../../../prisma/prisma.service';
import { LoggingService } from '../../logging/logging.service';
import { ResourceAccessService } from 'src/common/infrastructure/resource-access/resource-access.service';
import type { AuthenticatedUser } from 'src/common/types/auth.types';
import { ArchiveProposalArtifactUseCase } from './archive-proposal-artifact.use-case';
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

const artifactRow = {
  id: 'artifact-1',
  proposalId: 'proposal-1',
  storageKey: 'app/proposals/proposal-1/artifacts/uuid.html',
  fileName: 'demo.html',
  contentType: 'text/html',
  sizeBytes: 10,
  archivedAt: null as Date | null,
};

const mockPrisma = {
  proposal: { findUnique: vi.fn() },
  proposalArtifact: { findFirst: vi.fn(), update: vi.fn() },
};

const mockI18n = { t: vi.fn().mockReturnValue('mensagem') };
const mockLogging = { create: vi.fn() };
const mockResourceAccess = { assertCanRead: vi.fn() };

describe('ArchiveProposalArtifactUseCase', () => {
  let useCase: ArchiveProposalArtifactUseCase;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ArchiveProposalArtifactUseCase,
        FindOneProposalUseCase,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: I18nService, useValue: mockI18n },
        { provide: LoggingService, useValue: mockLogging },
        { provide: ResourceAccessService, useValue: mockResourceAccess },
      ],
    }).compile();
    useCase = module.get(ArchiveProposalArtifactUseCase);

    vi.clearAllMocks();
    mockPrisma.proposal.findUnique.mockResolvedValue({ ...proposalRow });
    mockResourceAccess.assertCanRead.mockResolvedValue(undefined);
    mockPrisma.proposalArtifact.findFirst.mockResolvedValue({ ...artifactRow });
    mockPrisma.proposalArtifact.update.mockImplementation(({ data }) => ({
      ...artifactRow,
      ...data,
    }));
  });

  it('arquiva o artefato sem apagar a linha nem trocar a storageKey', async () => {
    const result = await useCase.execute('proposal-1', 'artifact-1', admin);

    expect(mockPrisma.proposalArtifact.update).toHaveBeenCalledWith({
      where: { id: 'artifact-1' },
      data: { archivedAt: expect.any(Date) },
    });
    expect(result.storageKey).toBe(artifactRow.storageKey);
  });

  it('recusa artefato que não pertence à proposta informada', async () => {
    mockPrisma.proposalArtifact.findFirst.mockResolvedValue(null);

    await expect(
      useCase.execute('proposal-1', 'artifact-inexistente', admin),
    ).rejects.toThrow(NotFoundException);
    expect(mockPrisma.proposalArtifact.update).not.toHaveBeenCalled();
  });

  it('arquivar duas vezes não gera log duplicado', async () => {
    mockPrisma.proposalArtifact.findFirst.mockResolvedValue({
      ...artifactRow,
      archivedAt: new Date('2026-01-01'),
    });

    const result = await useCase.execute('proposal-1', 'artifact-1', admin);

    expect(mockPrisma.proposalArtifact.update).not.toHaveBeenCalled();
    expect(mockLogging.create).not.toHaveBeenCalled();
    expect(result.archivedAt).toEqual(new Date('2026-01-01'));
  });
});
