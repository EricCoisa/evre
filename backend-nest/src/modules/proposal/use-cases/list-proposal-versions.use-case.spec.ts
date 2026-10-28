import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from 'src/prisma/prisma.service';
import { ResourceAccessService } from 'src/common/infrastructure/resource-access/resource-access.service';
import type { AuthenticatedUser } from 'src/common/types/auth.types';
import {
  ListProposalVersionsUseCase,
  derivePublicationState,
} from './list-proposal-versions.use-case';
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
  // Rascunho atual — diferente de propósito do layout gravado em cada versão abaixo.
  layout: { v: 1, blocks: [{ id: 'draft-block', type: 'text' }] },
};

const mockPrisma = {
  proposal: { findUnique: vi.fn() },
  proposalVersion: { findMany: vi.fn() },
};

const mockI18n = { t: vi.fn((key: string) => key) };
const mockResourceAccess = { assertCanRead: vi.fn() };
const mockConfig = { get: vi.fn(() => 'https://app.example.com') };

describe('ListProposalVersionsUseCase', () => {
  let useCase: ListProposalVersionsUseCase;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ListProposalVersionsUseCase,
        FindOneProposalUseCase,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
        { provide: I18nService, useValue: mockI18n },
        { provide: ResourceAccessService, useValue: mockResourceAccess },
      ],
    }).compile();
    useCase = module.get(ListProposalVersionsUseCase);

    vi.clearAllMocks();
    mockPrisma.proposal.findUnique.mockResolvedValue({ ...row });
    mockResourceAccess.assertCanRead.mockResolvedValue(undefined);
  });

  it('busca ordenado por version desc', async () => {
    mockPrisma.proposalVersion.findMany.mockResolvedValue([]);

    await useCase.execute('id-1', admin);

    expect(mockPrisma.proposalVersion.findMany).toHaveBeenCalledWith({
      where: { proposalId: 'id-1' },
      orderBy: { version: 'desc' },
    });
  });

  it('editar o layout do rascunho depois de publicar não altera a versão — devolve o layout gravado na própria versão, não o do rascunho', async () => {
    const versionLayout = { v: 1, blocks: [{ id: 'published-block', type: 'text' }] };
    mockPrisma.proposalVersion.findMany.mockResolvedValue([
      {
        id: 'version-1',
        proposalId: 'id-1',
        version: 1,
        layout: versionLayout,
        publicToken: 'a'.repeat(16),
        revokedAt: null,
        validUntil: null,
      },
    ]);

    const [result] = await useCase.execute('id-1', admin);

    expect(result.layout).toEqual(versionLayout);
    expect(result.layout).not.toEqual(row.layout);
  });

  it('estado ACTIVE: publicToken presente, sem revokedAt, sem validUntil vencido', () => {
    expect(
      derivePublicationState({
        publicToken: 'tok',
        revokedAt: null,
        validUntil: null,
      }),
    ).toBe('ACTIVE');
  });

  it('estado EXPIRED: validUntil no passado, mesmo sem revokedAt', () => {
    expect(
      derivePublicationState({
        publicToken: 'tok',
        revokedAt: null,
        validUntil: new Date('2000-01-01'),
      }),
    ).toBe('EXPIRED');
  });

  it('estado REVOKED tem prioridade sobre EXPIRED', () => {
    expect(
      derivePublicationState({
        publicToken: 'tok',
        revokedAt: new Date(),
        validUntil: new Date('2000-01-01'),
      }),
    ).toBe('REVOKED');
  });

  it('estado NONE quando não há publicToken', () => {
    expect(
      derivePublicationState({
        publicToken: null,
        revokedAt: null,
        validUntil: null,
      }),
    ).toBe('NONE');
  });
});
