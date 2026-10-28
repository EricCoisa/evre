import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from 'src/prisma/prisma.service';
import { LoggingService } from '../../logging/logging.service';
import { ResourceAccessService } from 'src/common/infrastructure/resource-access/resource-access.service';
import type { AuthenticatedUser } from 'src/common/types/auth.types';
import { PublishProposalUseCase } from './publish-proposal.use-case';
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
  status: 'DRAFT',
  archivedAt: null as Date | null,
  layout: { v: 1, blocks: [{ id: 'a', type: 'text' }] } as Record<
    string,
    unknown
  > | null,
  totalCents: 150000,
  currency: 'BRL',
  recurrence: 'ONE_TIME',
  termDays: 30,
  validUntil: null as Date | null,
  includedItems: ['item 1'],
  optionalItems: [] as string[],
};

const mockTx = {
  proposalVersion: {
    updateMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  proposal: { update: vi.fn() },
};

const mockPrisma = {
  proposal: { findUnique: vi.fn() },
  $transaction: vi.fn((operation: (tx: typeof mockTx) => Promise<unknown>) =>
    operation(mockTx),
  ),
};

const mockI18n = { t: vi.fn((key: string) => key) };
const mockConfig = { get: vi.fn(() => 'https://app.example.com') };
const mockLogging = { create: vi.fn() };
const mockResourceAccess = { assertCanRead: vi.fn() };

describe('PublishProposalUseCase', () => {
  let useCase: PublishProposalUseCase;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        PublishProposalUseCase,
        FindOneProposalUseCase,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
        { provide: I18nService, useValue: mockI18n },
        { provide: LoggingService, useValue: mockLogging },
        { provide: ResourceAccessService, useValue: mockResourceAccess },
      ],
    }).compile();
    useCase = module.get(PublishProposalUseCase);

    vi.clearAllMocks();
    mockPrisma.proposal.findUnique.mockResolvedValue({ ...row });
    mockResourceAccess.assertCanRead.mockResolvedValue(undefined);
    mockTx.proposalVersion.updateMany.mockResolvedValue({ count: 0 });
    mockTx.proposalVersion.findFirst.mockResolvedValue(null);
    mockTx.proposalVersion.findUnique.mockResolvedValue(null);
    mockTx.proposalVersion.create.mockResolvedValue({
      id: 'version-1',
      version: 1,
      publicToken: 'a'.repeat(16),
      publishedAt: new Date('2026-01-01T00:00:00Z'),
    });
    mockTx.proposal.update.mockResolvedValue({ ...row, status: 'SENT' });
  });

  it('recusa publicar proposta arquivada', async () => {
    mockPrisma.proposal.findUnique.mockResolvedValue({
      ...row,
      archivedAt: new Date(),
    });

    await expect(useCase.execute('id-1', admin)).rejects.toThrow(
      BadRequestException,
    );
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('recusa publicar proposta sem layout', async () => {
    mockPrisma.proposal.findUnique.mockResolvedValue({
      ...row,
      layout: null,
    });

    await expect(useCase.execute('id-1', admin)).rejects.toThrow(
      BadRequestException,
    );
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('cria a primeira versão com token de 16 caracteres e muda status DRAFT -> SENT', async () => {
    const result = await useCase.execute('id-1', admin);

    expect(mockTx.proposalVersion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        proposalId: 'id-1',
        version: 1,
        layout: row.layout,
        totalCents: row.totalCents,
        publicToken: expect.stringMatching(/^[a-zA-Z0-9]{16}$/),
      }),
    });
    expect(mockTx.proposal.update).toHaveBeenCalledWith({
      where: { id: 'id-1' },
      data: { status: 'SENT' },
    });
    expect(result.status).toBe('SENT');
    expect(result.publicUrl).toContain('/p/');
  });

  it('version incrementa sem furo a partir da última existente', async () => {
    mockTx.proposalVersion.findFirst.mockResolvedValue({ version: 2 });
    mockTx.proposalVersion.create.mockResolvedValue({
      id: 'version-3',
      version: 3,
      publicToken: 'b'.repeat(16),
      publishedAt: new Date(),
    });

    const result = await useCase.execute('id-1', admin);

    expect(mockTx.proposalVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ version: 3 }),
      }),
    );
    expect(result.version).toBe(3);
  });

  it('publicar duas vezes revoga a versão vigente antes de criar a nova (nunca dois links)', async () => {
    await useCase.execute('id-1', admin);

    expect(mockTx.proposalVersion.updateMany).toHaveBeenCalledWith({
      where: { proposalId: 'id-1', publicToken: { not: null }, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    const revokeOrder =
      mockTx.proposalVersion.updateMany.mock.invocationCallOrder[0];
    const createOrder = mockTx.proposalVersion.create.mock.invocationCallOrder[0];
    expect(revokeOrder).toBeLessThan(createOrder);
  });

  it('não muda o status quando a proposta já não está em DRAFT', async () => {
    mockPrisma.proposal.findUnique.mockResolvedValue({
      ...row,
      status: 'SENT',
    });

    const result = await useCase.execute('id-1', admin);

    expect(mockTx.proposal.update).not.toHaveBeenCalled();
    expect(result.status).toBe('SENT');
  });

  it('tenta de novo quando o token sorteado já existe (colisão)', async () => {
    mockTx.proposalVersion.findUnique
      .mockResolvedValueOnce({ id: 'already-exists' })
      .mockResolvedValueOnce(null);

    await useCase.execute('id-1', admin);

    expect(mockTx.proposalVersion.findUnique).toHaveBeenCalledTimes(2);
    expect(mockTx.proposalVersion.create).toHaveBeenCalledTimes(1);
  });
});
