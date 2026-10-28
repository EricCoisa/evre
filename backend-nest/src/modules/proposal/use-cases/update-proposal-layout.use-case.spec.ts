import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from 'src/prisma/prisma.service';
import { LoggingService } from '../../logging/logging.service';
import { ResourceAccessService } from 'src/common/infrastructure/resource-access/resource-access.service';
import type { AuthenticatedUser } from 'src/common/types/auth.types';
import { UpdateProposalLayoutUseCase } from './update-proposal-layout.use-case';
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
  layout: null,
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

describe('UpdateProposalLayoutUseCase', () => {
  let useCase: UpdateProposalLayoutUseCase;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UpdateProposalLayoutUseCase,
        FindOneProposalUseCase,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: I18nService, useValue: mockI18n },
        { provide: LoggingService, useValue: mockLogging },
        { provide: ResourceAccessService, useValue: mockResourceAccess },
      ],
    }).compile();
    useCase = module.get(UpdateProposalLayoutUseCase);

    vi.clearAllMocks();
    mockPrisma.proposal.findUnique.mockResolvedValue({ ...row });
    mockPrisma.proposal.update.mockResolvedValue({ ...row });
    mockResourceAccess.assertCanRead.mockResolvedValue(undefined);
  });

  it('grava o layout quando a proposta está em DRAFT', async () => {
    await useCase.execute('id-1', { layout: { v: 1, blocks: [] } }, admin);

    expect(mockPrisma.proposal.update).toHaveBeenCalledWith({
      where: { id: 'id-1' },
      data: { layout: { v: 1, blocks: [] } },
    });
  });

  it('recusa quando a proposta não está em DRAFT', async () => {
    mockPrisma.proposal.findUnique.mockResolvedValue({
      ...row,
      status: 'SENT',
    });

    await expect(
      useCase.execute('id-1', { layout: { v: 1, blocks: [] } }, admin),
    ).rejects.toThrow(BadRequestException);
    expect(mockPrisma.proposal.update).not.toHaveBeenCalled();
  });
});
