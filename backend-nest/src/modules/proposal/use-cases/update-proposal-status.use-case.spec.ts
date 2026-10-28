import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from 'src/prisma/prisma.service';
import { LoggingService } from '../../logging/logging.service';
import { ResourceAccessService } from 'src/common/infrastructure/resource-access/resource-access.service';
import type { AuthenticatedUser } from 'src/common/types/auth.types';
import { UpdateProposalStatusUseCase } from './update-proposal-status.use-case';
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
  lostReason: null as string | null,
};

const mockPrisma = {
  proposal: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
};

const mockI18n = { t: vi.fn().mockReturnValue('mensagem') };
const mockLogging = { create: vi.fn() };
const mockResourceAccess = { assertCanRead: vi.fn() };

describe('UpdateProposalStatusUseCase', () => {
  let useCase: UpdateProposalStatusUseCase;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UpdateProposalStatusUseCase,
        FindOneProposalUseCase,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: I18nService, useValue: mockI18n },
        { provide: LoggingService, useValue: mockLogging },
        { provide: ResourceAccessService, useValue: mockResourceAccess },
      ],
    }).compile();
    useCase = module.get(UpdateProposalStatusUseCase);

    vi.clearAllMocks();
    mockPrisma.proposal.findUnique.mockResolvedValue({ ...row });
    mockPrisma.proposal.update.mockResolvedValue({ ...row });
    mockResourceAccess.assertCanRead.mockResolvedValue(undefined);
  });

  it('exige lostReason quando o novo status é LOST', async () => {
    await expect(
      useCase.execute('id-1', { status: 'LOST' } as never, admin),
    ).rejects.toThrow(BadRequestException);
    expect(mockPrisma.proposal.update).not.toHaveBeenCalled();
  });

  it('grava LOST com lostReason preenchido', async () => {
    await useCase.execute(
      'id-1',
      { status: 'LOST', lostReason: 'Preço acima do orçamento' } as never,
      admin,
    );

    expect(mockPrisma.proposal.update).toHaveBeenCalledWith({
      where: { id: 'id-1' },
      data: { status: 'LOST', lostReason: 'Preço acima do orçamento' },
    });
  });

  it('recusa transição a partir de um status terminal (ACCEPTED)', async () => {
    mockPrisma.proposal.findUnique.mockResolvedValue({
      ...row,
      status: 'ACCEPTED',
    });

    await expect(
      useCase.execute('id-1', { status: 'DRAFT' } as never, admin),
    ).rejects.toThrow(BadRequestException);
    expect(mockPrisma.proposal.update).not.toHaveBeenCalled();
  });

  it('permite transição livre entre status não terminais', async () => {
    await useCase.execute('id-1', { status: 'ACCEPTED' } as never, admin);

    expect(mockPrisma.proposal.update).toHaveBeenCalledWith({
      where: { id: 'id-1' },
      data: { status: 'ACCEPTED', lostReason: null },
    });
  });
});
