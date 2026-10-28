import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from 'src/prisma/prisma.service';
import { LoggingService } from '../../logging/logging.service';
import { ResourceAccessService } from 'src/common/infrastructure/resource-access/resource-access.service';
import type { AuthenticatedUser } from 'src/common/types/auth.types';
import { RevokeProposalPublicationUseCase } from './revoke-proposal-publication.use-case';
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
  proposalVersion: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
};

const mockI18n = { t: vi.fn((key: string) => key) };
const mockLogging = { create: vi.fn() };
const mockResourceAccess = { assertCanRead: vi.fn() };

describe('RevokeProposalPublicationUseCase', () => {
  let useCase: RevokeProposalPublicationUseCase;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        RevokeProposalPublicationUseCase,
        FindOneProposalUseCase,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: I18nService, useValue: mockI18n },
        { provide: LoggingService, useValue: mockLogging },
        { provide: ResourceAccessService, useValue: mockResourceAccess },
      ],
    }).compile();
    useCase = module.get(RevokeProposalPublicationUseCase);

    vi.clearAllMocks();
    mockPrisma.proposal.findUnique.mockResolvedValue({ ...row });
    mockResourceAccess.assertCanRead.mockResolvedValue(undefined);
  });

  it('revoga a versão vigente (publicToken ativo, sem revokedAt)', async () => {
    mockPrisma.proposalVersion.findFirst.mockResolvedValueOnce({
      id: 'version-2',
      version: 2,
      revokedAt: null,
    });
    mockPrisma.proposalVersion.update.mockResolvedValue({
      id: 'version-2',
      version: 2,
      revokedAt: new Date(),
    });

    const result = await useCase.execute('id-1', admin);

    expect(mockPrisma.proposalVersion.update).toHaveBeenCalledWith({
      where: { id: 'version-2' },
      data: { revokedAt: expect.any(Date) },
    });
    expect(result.alreadyRevoked).toBe(false);
    expect(result.version).toBe(2);
  });

  it('revogar duas vezes não lança — devolve alreadyRevoked sem erro', async () => {
    mockPrisma.proposalVersion.findFirst
      .mockResolvedValueOnce(null) // não há versão vigente (já revogada)
      .mockResolvedValueOnce({
        id: 'version-2',
        version: 2,
        revokedAt: new Date('2026-01-01T00:00:00Z'),
      });

    const result = await useCase.execute('id-1', admin);

    expect(mockPrisma.proposalVersion.update).not.toHaveBeenCalled();
    expect(result.alreadyRevoked).toBe(true);
    expect(result.message).toBe('proposal.already_revoked');
  });

  it('lança version_not_found quando a proposta nunca teve nenhuma versão', async () => {
    mockPrisma.proposalVersion.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    await expect(useCase.execute('id-1', admin)).rejects.toThrow(
      NotFoundException,
    );
    expect(mockPrisma.proposalVersion.update).not.toHaveBeenCalled();
  });
});
