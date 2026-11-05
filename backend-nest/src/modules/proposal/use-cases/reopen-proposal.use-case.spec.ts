import { Test } from '@nestjs/testing';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from 'src/prisma/prisma.service';
import { LoggingService } from '../../logging/logging.service';
import { ResourceAccessService } from 'src/common/infrastructure/resource-access/resource-access.service';
import type { AuthenticatedUser } from 'src/common/types/auth.types';
import { ReopenProposalUseCase } from './reopen-proposal.use-case';
import { FindOneProposalUseCase } from './find-one.use-case';

const admin: AuthenticatedUser = {
  id: 'admin-1',
  email: 'admin@example.com',
  roleId: 'role-admin',
  roleName: 'ADMIN',
};

const baseRow = {
  id: 'id-1',
  companyId: null as string | null,
  ownerId: 'user-1',
  name: 'Proposta Exemplo',
};

const updatedDraft = { ...baseRow, status: 'DRAFT', lostReason: null };

const mockPrisma = {
  proposal: { findUnique: vi.fn(), update: vi.fn() },
  proposalVersion: { updateMany: vi.fn() },
  $transaction: vi.fn(),
};

const mockI18n = { t: vi.fn((key: string) => key) };
const mockLogging = { create: vi.fn() };
const mockResourceAccess = { assertCanRead: vi.fn() };

describe('ReopenProposalUseCase', () => {
  let useCase: ReopenProposalUseCase;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ReopenProposalUseCase,
        FindOneProposalUseCase,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: I18nService, useValue: mockI18n },
        { provide: LoggingService, useValue: mockLogging },
        { provide: ResourceAccessService, useValue: mockResourceAccess },
      ],
    }).compile();
    useCase = module.get(ReopenProposalUseCase);

    vi.clearAllMocks();
    mockResourceAccess.assertCanRead.mockResolvedValue(undefined);
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => Promise<unknown>) =>
      fn(mockPrisma),
    );
    mockPrisma.proposalVersion.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.proposal.update.mockResolvedValue(updatedDraft);
  });

  it('reabre proposta ACCEPTED → DRAFT e registra log', async () => {
    mockPrisma.proposal.findUnique.mockResolvedValue({
      ...baseRow,
      status: 'ACCEPTED',
    });

    const result = await useCase.execute('id-1', admin);

    expect(mockPrisma.proposal.update).toHaveBeenCalledWith({
      where: { id: 'id-1' },
      data: { status: 'DRAFT', lostReason: null },
    });
    expect(result.status).toBe('DRAFT');
    expect(mockLogging.create).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: expect.objectContaining({ previousStatus: 'ACCEPTED' }) }),
      admin.id,
    );
  });

  it('reabre proposta LOST → DRAFT e limpa lostReason', async () => {
    mockPrisma.proposal.findUnique.mockResolvedValue({
      ...baseRow,
      status: 'LOST',
      lostReason: 'Preço alto',
    });

    await useCase.execute('id-1', admin);

    expect(mockPrisma.proposal.update).toHaveBeenCalledWith({
      where: { id: 'id-1' },
      data: { status: 'DRAFT', lostReason: null },
    });
  });

  it('revoga versão pública vigente na mesma transação', async () => {
    mockPrisma.proposal.findUnique.mockResolvedValue({
      ...baseRow,
      status: 'SENT',
    });
    mockPrisma.proposalVersion.updateMany.mockResolvedValue({ count: 1 });

    await useCase.execute('id-1', admin);

    expect(mockPrisma.proposalVersion.updateMany).toHaveBeenCalledWith({
      where: { proposalId: 'id-1', publicToken: { not: null }, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('idempotente: já DRAFT não registra log', async () => {
    mockPrisma.proposal.findUnique.mockResolvedValue({
      ...baseRow,
      status: 'DRAFT',
    });

    await useCase.execute('id-1', admin);

    expect(mockLogging.create).not.toHaveBeenCalled();
  });
});
