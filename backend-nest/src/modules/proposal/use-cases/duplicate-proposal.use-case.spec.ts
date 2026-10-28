import { Test } from '@nestjs/testing';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from 'src/prisma/prisma.service';
import { LoggingService } from '../../logging/logging.service';
import { ResourceAccessService } from 'src/common/infrastructure/resource-access/resource-access.service';
import type { AuthenticatedUser } from 'src/common/types/auth.types';
import { DuplicateProposalUseCase } from './duplicate-proposal.use-case';
import { FindOneProposalUseCase } from './find-one.use-case';

const admin: AuthenticatedUser = {
  id: 'admin-1',
  email: 'admin@example.com',
  roleId: 'role-admin',
  roleName: 'ADMIN',
};

const source = {
  id: 'id-1',
  companyId: 'company-1',
  ownerId: 'owner-original',
  name: 'Proposta original',
  status: 'SENT',
  layout: { v: 1, blocks: [] },
  totalCents: 150000,
  currency: 'BRL',
  recurrence: 'MONTHLY',
  termDays: 30,
  validUntil: null,
  includedItems: ['item-1'],
  optionalItems: [],
};

const mockPrisma = {
  proposal: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  // Confirma que duplicate nunca toca ProposalVersion (sem versão, sem token).
  proposalVersion: {
    create: vi.fn(),
  },
};

const mockI18n = { t: vi.fn().mockReturnValue('mensagem') };
const mockLogging = { create: vi.fn() };
const mockResourceAccess = { assertCanRead: vi.fn() };

describe('DuplicateProposalUseCase', () => {
  let useCase: DuplicateProposalUseCase;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        DuplicateProposalUseCase,
        FindOneProposalUseCase,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: I18nService, useValue: mockI18n },
        { provide: LoggingService, useValue: mockLogging },
        { provide: ResourceAccessService, useValue: mockResourceAccess },
      ],
    }).compile();
    useCase = module.get(DuplicateProposalUseCase);

    vi.clearAllMocks();
    mockPrisma.proposal.findUnique.mockResolvedValue({ ...source });
    mockPrisma.proposal.create.mockResolvedValue({
      ...source,
      id: 'id-2',
      name: `${source.name} (cópia)`,
      status: 'DRAFT',
    });
    mockResourceAccess.assertCanRead.mockResolvedValue(undefined);
  });

  it('copia nome, layout e envelope, e nasce DRAFT sem versão nem token', async () => {
    await useCase.execute('id-1', admin);

    expect(mockPrisma.proposal.create).toHaveBeenCalledWith({
      data: {
        name: 'Proposta original (cópia)',
        ownerId: admin.id,
        companyId: 'company-1',
        layout: { v: 1, blocks: [] },
        totalCents: 150000,
        currency: 'BRL',
        recurrence: 'MONTHLY',
        termDays: 30,
        validUntil: null,
        includedItems: ['item-1'],
        optionalItems: [],
      },
    });
    // status DRAFT vem do @default(DRAFT) do schema — não é passado explicitamente.
    expect(
      (mockPrisma.proposal.create.mock.calls[0][0] as { data: object }).data,
    ).not.toHaveProperty('status');
    expect(mockPrisma.proposalVersion.create).not.toHaveBeenCalled();
  });
});
