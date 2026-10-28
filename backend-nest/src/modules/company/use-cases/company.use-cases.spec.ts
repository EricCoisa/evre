import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from 'src/prisma/prisma.service';
import { LoggingService } from '../../logging/logging.service';
import { ResourceAccessService } from 'src/common/infrastructure/resource-access/resource-access.service';
import type { AuthenticatedUser } from 'src/common/types/auth.types';
import { FindAllCompanyUseCase } from './find-all.use-case';
import { FindOneCompanyUseCase } from './find-one.use-case';
import { CreateCompanyUseCase } from './create.use-case';
import { UpdateCompanyUseCase } from './update.use-case';
import { RemoveCompanyUseCase } from './remove.use-case';

const row = {
  id: 'id-1',
  name: 'Exemplo',
  tradeName: null,
  taxId: null,
  site: null,
  segment: null,
  notes: null,
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
  company: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
};

const mockI18n = { t: vi.fn().mockReturnValue('mensagem') };
const mockLogging = { create: vi.fn() };
const mockResourceAccess = {
  assertCanRead: vi.fn(),
  scopeFilter: vi.fn(),
};

describe('Company use-cases', () => {
  let findAll: FindAllCompanyUseCase;
  let findOne: FindOneCompanyUseCase;
  let create: CreateCompanyUseCase;
  let update: UpdateCompanyUseCase;
  let remove: RemoveCompanyUseCase;

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [
        FindAllCompanyUseCase,
        FindOneCompanyUseCase,
        CreateCompanyUseCase,
        UpdateCompanyUseCase,
        RemoveCompanyUseCase,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: I18nService, useValue: mockI18n },
        { provide: LoggingService, useValue: mockLogging },
        { provide: ResourceAccessService, useValue: mockResourceAccess },
      ],
    }).compile();

    findAll = mod.get(FindAllCompanyUseCase);
    findOne = mod.get(FindOneCompanyUseCase);
    create = mod.get(CreateCompanyUseCase);
    update = mod.get(UpdateCompanyUseCase);
    remove = mod.get(RemoveCompanyUseCase);

    vi.clearAllMocks();
    mockPrisma.company.findMany.mockResolvedValue([row]);
    mockPrisma.company.findUnique.mockResolvedValue({ ...row, archivedAt: null });
    mockPrisma.company.count.mockResolvedValue(1);
    mockPrisma.company.create.mockResolvedValue(row);
    mockPrisma.company.update.mockResolvedValue({ ...row, archivedAt: new Date() });
    mockResourceAccess.assertCanRead.mockResolvedValue(undefined);
    mockResourceAccess.scopeFilter.mockResolvedValue(undefined);
  });

  describe('FindAllCompanyUseCase', () => {
    it('exclui arquivadas por padrão', async () => {
      await findAll.execute({ page: 1, limit: 10, pagination: false }, admin);

      const where = mockPrisma.company.findMany.mock.calls[0][0].where as {
        archivedAt: unknown;
      };
      expect(where.archivedAt).toBeNull();
    });

    it('aplica o scopeFilter do usuário no where', async () => {
      mockResourceAccess.scopeFilter.mockResolvedValue({
        OR: [{ companyId: { in: ['id-1'] } }, { projectId: { in: [] } }],
      });

      await findAll.execute({ page: 1, limit: 10, pagination: false }, user);

      expect(mockResourceAccess.scopeFilter).toHaveBeenCalledWith(user);
      const where = mockPrisma.company.findMany.mock.calls[0][0].where as {
        AND?: unknown[];
      };
      expect(where.AND).toEqual(
        expect.arrayContaining([{ id: { in: ['id-1'] } }]),
      );
    });

    it('não filtra por id quando o usuário é ADMIN (scopeFilter undefined)', async () => {
      await findAll.execute({ page: 1, limit: 10, pagination: false }, admin);

      const where = mockPrisma.company.findMany.mock.calls[0][0].where as {
        AND?: unknown[];
      };
      expect(where.AND).toBeUndefined();
    });
  });

  describe('FindOneCompanyUseCase', () => {
    it('libera para ADMIN mesmo sem Membership', async () => {
      const result = await findOne.execute('id-1', admin);

      expect(result).toEqual(expect.objectContaining({ id: 'id-1' }));
      expect(mockResourceAccess.assertCanRead).toHaveBeenCalledWith(admin, {
        companyId: 'id-1',
      });
    });

    it('nega com NotFoundException para não-ADMIN sem vínculo', async () => {
      mockResourceAccess.assertCanRead.mockRejectedValue(
        new NotFoundException('mensagem'),
      );

      await expect(findOne.execute('id-1', user)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('lança NotFoundException quando a empresa não existe, sem consultar Membership', async () => {
      mockPrisma.company.findUnique.mockResolvedValue(null);

      await expect(findOne.execute('nao-existe', admin)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockResourceAccess.assertCanRead).not.toHaveBeenCalled();
    });
  });

  describe('CreateCompanyUseCase', () => {
    it('grava só com nome e registra no audit trail', async () => {
      await create.execute({ name: 'Exemplo' } as never, 'user-1');

      expect(mockPrisma.company.create).toHaveBeenCalledWith({
        data: { name: 'Exemplo' },
      });
      expect(mockLogging.create).toHaveBeenCalledWith(
        expect.objectContaining({ module: 'COMPANY' }),
        'user-1',
      );
    });
  });

  describe('UpdateCompanyUseCase', () => {
    it('valida a existência (via findOne) antes de escrever', async () => {
      mockPrisma.company.findUnique.mockResolvedValue(null);

      await expect(
        update.execute('nao-existe', { name: 'x' } as never, admin),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.company.update).not.toHaveBeenCalled();
    });
  });

  describe('RemoveCompanyUseCase', () => {
    it('arquiva (seta archivedAt) e não apaga', async () => {
      const archived = await remove.execute('id-1', admin);

      expect(mockPrisma.company.update).toHaveBeenCalledWith({
        where: { id: 'id-1' },
        data: { archivedAt: expect.any(Date) },
      });
      expect(archived.archivedAt).toBeInstanceOf(Date);
    });

    it('é idempotente: empresa já arquivada não atualiza nem loga de novo', async () => {
      mockPrisma.company.findUnique.mockResolvedValue({
        ...row,
        archivedAt: new Date(),
      });

      await remove.execute('id-1', admin);

      expect(mockPrisma.company.update).not.toHaveBeenCalled();
      expect(mockLogging.create).not.toHaveBeenCalled();
    });
  });
});
