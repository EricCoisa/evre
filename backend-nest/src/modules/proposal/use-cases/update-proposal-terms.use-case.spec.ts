import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from 'src/prisma/prisma.service';
import { LoggingService } from '../../logging/logging.service';
import { ResourceAccessService } from 'src/common/infrastructure/resource-access/resource-access.service';
import type { AuthenticatedUser } from 'src/common/types/auth.types';
import { UpdateProposalTermsUseCase } from './update-proposal-terms.use-case';
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
  totalCents: null,
  currency: 'BRL',
  recurrence: 'ONE_TIME',
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

describe('UpdateProposalTermsUseCase', () => {
  let useCase: UpdateProposalTermsUseCase;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UpdateProposalTermsUseCase,
        FindOneProposalUseCase,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: I18nService, useValue: mockI18n },
        { provide: LoggingService, useValue: mockLogging },
        { provide: ResourceAccessService, useValue: mockResourceAccess },
      ],
    }).compile();
    useCase = module.get(UpdateProposalTermsUseCase);

    vi.clearAllMocks();
    mockPrisma.proposal.findUnique.mockResolvedValue({ ...row });
    mockPrisma.proposal.update.mockResolvedValue({ ...row });
    mockResourceAccess.assertCanRead.mockResolvedValue(undefined);
  });

  it('grava o envelope quando a proposta está em DRAFT', async () => {
    await useCase.execute('id-1', { totalCents: 150000 }, admin);

    expect(mockPrisma.proposal.update).toHaveBeenCalledWith({
      where: { id: 'id-1' },
      data: { totalCents: 150000, recurrence: undefined },
    });
  });

  it('recusa quando a proposta não está em DRAFT', async () => {
    mockPrisma.proposal.findUnique.mockResolvedValue({
      ...row,
      status: 'ACCEPTED',
    });

    await expect(
      useCase.execute('id-1', { totalCents: 150000 }, admin),
    ).rejects.toThrow(BadRequestException);
    expect(mockPrisma.proposal.update).not.toHaveBeenCalled();
  });
});
