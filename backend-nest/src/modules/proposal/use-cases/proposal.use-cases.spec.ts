import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from 'src/prisma/prisma.service';
import { LoggingService } from '../../logging/logging.service';
import { ResourceAccessService } from 'src/common/infrastructure/resource-access/resource-access.service';
import type { AuthenticatedUser } from 'src/common/types/auth.types';
import { FindAllProposalUseCase } from './find-all.use-case';
import { FindOneProposalUseCase } from './find-one.use-case';
import { CreateProposalUseCase } from './create.use-case';
import { UpdateProposalUseCase } from './update.use-case';
import { RemoveProposalUseCase } from './remove.use-case';

const row = {
  id: 'id-1',
  companyId: null as string | null,
  ownerId: 'user-1',
  name: 'Exemplo',
  status: 'DRAFT',
  lostReason: null,
  layout: null,
  totalCents: null,
  currency: 'BRL',
  recurrence: 'ONE_TIME',
  termDays: null,
  validUntil: null,
  includedItems: [] as string[],
  optionalItems: [] as string[],
  archivedAt: null as Date | null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const admin: AuthenticatedUser = {
  id: 'admin-1',
  email: 'admin@example.com',
  roleId: 'role-admin',
  roleName: 'ADMIN',
};
const user: AuthenticatedUser = {
  id: 'user-1',
  email: 'user@example.com',
  roleId: 'role-user',
  roleName: 'USER',
};

const mockPrisma = {
  proposal: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  membership: {
    findMany: vi.fn(),
  },
};

const mockI18n = { t: vi.fn().mockReturnValue('mensagem') };
const mockLogging = { create: vi.fn() };
const mockResourceAccess = {
  assertCanRead: vi.fn(),
  canSeeCommercials: vi.fn(),
  scopeFilter: vi.fn(),
};

describe('Proposal use-cases', () => {
  let findAll: FindAllProposalUseCase;
  let findOne: FindOneProposalUseCase;
  let create: CreateProposalUseCase;
  let update: UpdateProposalUseCase;
  let remove: RemoveProposalUseCase;

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [
        FindAllProposalUseCase,
        FindOneProposalUseCase,
        CreateProposalUseCase,
        UpdateProposalUseCase,
        RemoveProposalUseCase,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: I18nService, useValue: mockI18n },
        { provide: LoggingService, useValue: mockLogging },
        { provide: ResourceAccessService, useValue: mockResourceAccess },
      ],
    }).compile();

    findAll = mod.get(FindAllProposalUseCase);
    findOne = mod.get(FindOneProposalUseCase);
    create = mod.get(CreateProposalUseCase);
    update = mod.get(UpdateProposalUseCase);
    remove = mod.get(RemoveProposalUseCase);

    vi.clearAllMocks();
    mockPrisma.proposal.findMany.mockResolvedValue([row]);
    mockPrisma.proposal.findUnique.mockResolvedValue({ ...row });
    mockPrisma.proposal.count.mockResolvedValue(1);
    mockPrisma.proposal.create.mockResolvedValue(row);
    mockPrisma.proposal.update.mockResolvedValue({ ...row, archivedAt: new Date() });
    mockPrisma.proposal.delete.mockResolvedValue(row);
    mockResourceAccess.assertCanRead.mockResolvedValue(undefined);
    mockResourceAccess.canSeeCommercials.mockResolvedValue(true);
    mockResourceAccess.scopeFilter.mockResolvedValue(undefined);
    mockPrisma.membership.findMany.mockResolvedValue([]);
  });

  describe('FindAllProposalUseCase', () => {
    it('exclui arquivadas e ordena por updatedAt asc (mais dias sem movimento primeiro)', async () => {
      await findAll.execute({ page: 1, limit: 10, pagination: false }, admin);

      const args = mockPrisma.proposal.findMany.mock.calls[0][0] as {
        where: { archivedAt: unknown };
        orderBy: { updatedAt: string };
      };
      expect(args.where.archivedAt).toBeNull();
      expect(args.orderBy).toEqual({ updatedAt: 'asc' });
    });

    it('devolve daysWithoutMovement calculado a partir de updatedAt e companyName do join', async () => {
      const oldRow = {
        ...row,
        updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        company: { name: 'Acme' },
      };
      mockPrisma.proposal.findMany.mockResolvedValue([oldRow]);

      const result = (await findAll.execute(
        { page: 1, limit: 10, pagination: false },
        admin,
      )) as Array<{ daysWithoutMovement: number; companyName: string | null }>;

      expect(result[0].daysWithoutMovement).toBe(5);
      expect(result[0].companyName).toBe('Acme');
    });

    it('busca por nome da proposta OU da empresa vinculada', async () => {
      await findAll.execute(
        { page: 1, limit: 10, pagination: false, search: 'acme' },
        admin,
      );

      const args = mockPrisma.proposal.findMany.mock.calls[0][0] as {
        where: { AND?: Array<{ OR?: unknown[] }> };
      };
      expect(args.where.AND?.[0].OR).toEqual([
        { name: { contains: 'acme', mode: 'insensitive' } },
        { company: { name: { contains: 'acme', mode: 'insensitive' } } },
      ]);
    });

    it('filtra por companyId quando a query manda filter.companyId', async () => {
      await findAll.execute(
        { page: 1, limit: 10, pagination: false, filter: { companyId: 'company-1' } },
        admin,
      );

      const args = mockPrisma.proposal.findMany.mock.calls[0][0] as {
        where: { AND?: unknown[] };
      };
      expect(args.where.AND).toEqual(
        expect.arrayContaining([{ companyId: 'company-1' }]),
      );
    });

    it('filtra por memberships com canSeeCommercials para não-ADMIN', async () => {
      mockPrisma.membership.findMany.mockResolvedValue([
        { companyId: 'company-1' },
      ]);

      await findAll.execute({ page: 1, limit: 10, pagination: false }, user);

      expect(mockPrisma.membership.findMany).toHaveBeenCalledWith({
        where: { userId: user.id, canSeeCommercials: true },
        select: { companyId: true },
      });
      const where = mockPrisma.proposal.findMany.mock.calls[0][0].where as {
        AND?: unknown[];
      };
      expect(where.AND).toEqual(
        expect.arrayContaining([
          { OR: [{ companyId: { in: ['company-1'] } }, { companyId: null }] },
        ]),
      );
    });
  });

  describe('FindOneProposalUseCase', () => {
    it('libera para ADMIN mesmo sem Membership', async () => {
      mockPrisma.proposal.findUnique.mockResolvedValue({ ...row, companyId: 'c1' });
      const result = await findOne.execute('id-1', admin);

      expect(result).toEqual(expect.objectContaining({ id: 'id-1' }));
      expect(mockResourceAccess.canSeeCommercials).toHaveBeenCalledWith(admin, {
        companyId: 'c1',
      });
    });

    it('libera proposta sem empresa para qualquer role', async () => {
      const result = await findOne.execute('id-1', user);

      expect(result).toEqual(expect.objectContaining({ id: 'id-1' }));
      expect(mockResourceAccess.canSeeCommercials).not.toHaveBeenCalled();
    });

    it('nega com NotFoundException para não-ADMIN sem canSeeCommercials', async () => {
      mockPrisma.proposal.findUnique.mockResolvedValue({ ...row, companyId: 'c1' });
      mockResourceAccess.canSeeCommercials.mockResolvedValue(false);

      await expect(findOne.execute('id-1', user)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('lança NotFoundException quando a proposta não existe', async () => {
      mockPrisma.proposal.findUnique.mockResolvedValue(null);

      await expect(findOne.execute('nao-existe', admin)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockResourceAccess.canSeeCommercials).not.toHaveBeenCalled();
    });
  });

  describe('CreateProposalUseCase', () => {
    it('grava só com nome e ownerId vindo do requisitante', async () => {
      await create.execute({ name: 'Exemplo' } as never, 'user-1');

      expect(mockPrisma.proposal.create).toHaveBeenCalledWith({
        data: { name: 'Exemplo', ownerId: 'user-1' },
      });
      expect(mockLogging.create).toHaveBeenCalledWith(
        expect.objectContaining({ module: 'PROPOSAL' }),
        'user-1',
      );
    });
  });

  describe('UpdateProposalUseCase', () => {
    it('valida a existência (via findOne) antes de escrever', async () => {
      mockPrisma.proposal.findUnique.mockResolvedValue(null);

      await expect(
        update.execute('nao-existe', { name: 'x' } as never, admin),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.proposal.update).not.toHaveBeenCalled();
    });
  });

  describe('RemoveProposalUseCase', () => {
    it('arquiva (seta archivedAt) e não apaga', async () => {
      const archived = await remove.execute('id-1', admin);

      expect(mockPrisma.proposal.update).toHaveBeenCalledWith({
        where: { id: 'id-1' },
        data: { archivedAt: expect.any(Date) },
      });
      expect(mockPrisma.proposal.delete).not.toHaveBeenCalled();
      expect(archived.archivedAt).toBeInstanceOf(Date);
    });

    it('é idempotente: proposta já arquivada não atualiza nem loga de novo', async () => {
      mockPrisma.proposal.findUnique.mockResolvedValue({
        ...row,
        archivedAt: new Date(),
      });

      await remove.execute('id-1', admin);

      expect(mockPrisma.proposal.update).not.toHaveBeenCalled();
      expect(mockLogging.create).not.toHaveBeenCalled();
    });
  });
});
