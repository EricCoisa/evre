import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../../prisma/prisma.service';
import { LoggingService } from '../../logging/logging.service';
import { I18nService } from 'nestjs-i18n';
import { ResourceAccessService } from 'src/common/infrastructure/resource-access/resource-access.service';
import type { AuthenticatedUser } from 'src/common/types/auth.types';
import { FindOneProjectUseCase } from './find-one.use-case';
import { CreateProjectUseCase } from './create.use-case';
import { UpdateProjectUseCase } from './update.use-case';
import { RemoveProjectUseCase } from './remove.use-case';
import { GetBoardUseCase } from './get-board.use-case';
import { CreateMilestoneUseCase } from './create-milestone.use-case';
import { MoveTaskUseCase } from './move-task.use-case';

const BASE_PROJECT = {
  id: 'project-1',
  companyId: 'company-1',
  name: 'Projeto X',
  description: null,
  status: 'ACTIVE' as const,
  archivedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const admin: AuthenticatedUser = {
  id: 'admin-1',
  email: 'admin@example.com',
  roleId: 'role-admin',
  roleName: 'ADMIN',
};

describe('Project use-cases', () => {
  let prisma: Record<string, Record<string, ReturnType<typeof vi.fn>>>;
  let loggingService: { create: ReturnType<typeof vi.fn> };
  let i18n: { t: ReturnType<typeof vi.fn> };
  let resourceAccess: {
    assertCanRead: ReturnType<typeof vi.fn>;
    scopeFilter: ReturnType<typeof vi.fn>;
  };
  let findOne: FindOneProjectUseCase;

  beforeEach(() => {
    prisma = {
      project: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
      },
      company: {
        findUnique: vi.fn(),
      },
      projectMilestone: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        aggregate: vi.fn(),
      },
      projectTask: {
        findFirst: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn(prisma)),
    };
    loggingService = { create: vi.fn() };
    i18n = { t: vi.fn((key: string) => key) };
    resourceAccess = {
      assertCanRead: vi.fn(),
      scopeFilter: vi.fn(),
    };

    findOne = new FindOneProjectUseCase(
      prisma as unknown as PrismaService,
      i18n as unknown as I18nService,
      resourceAccess as unknown as ResourceAccessService,
    );
  });

  describe('FindOneProjectUseCase', () => {
    it('devolve o projeto quando encontrado e com acesso', async () => {
      prisma.project.findUnique.mockResolvedValueOnce(BASE_PROJECT);
      resourceAccess.assertCanRead.mockResolvedValueOnce(undefined);

      const result = await findOne.execute('project-1', admin);
      expect(result).toEqual(BASE_PROJECT);
      expect(resourceAccess.assertCanRead).toHaveBeenCalledWith(admin, {
        companyId: 'company-1',
        projectId: 'project-1',
      });
    });

    it('lança 404 quando não encontrado', async () => {
      prisma.project.findUnique.mockResolvedValueOnce(null);
      await expect(findOne.execute('nope', admin)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('CreateProjectUseCase', () => {
    it('cria projeto vinculado a empresa existente', async () => {
      const uc = new CreateProjectUseCase(
        prisma as unknown as PrismaService,
        loggingService as unknown as LoggingService,
        i18n as unknown as I18nService,
      );
      prisma.company.findUnique.mockResolvedValueOnce({ id: 'company-1', archivedAt: null });
      prisma.project.create.mockResolvedValueOnce(BASE_PROJECT);

      const result = await uc.execute(
        { companyId: 'company-1', name: 'Projeto X' },
        admin.id,
      );
      expect(result.name).toBe('Projeto X');
      expect(prisma.project.create).toHaveBeenCalledWith({
        data: { companyId: 'company-1', name: 'Projeto X' },
      });
    });

    it('rejeita empresa inexistente', async () => {
      const uc = new CreateProjectUseCase(
        prisma as unknown as PrismaService,
        loggingService as unknown as LoggingService,
        i18n as unknown as I18nService,
      );
      prisma.company.findUnique.mockResolvedValueOnce(null);
      await expect(
        uc.execute({ companyId: 'nope', name: 'X' }, admin.id),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('UpdateProjectUseCase', () => {
    it('seta archivedAt quando status=ARCHIVED', async () => {
      const uc = new UpdateProjectUseCase(
        prisma as unknown as PrismaService,
        loggingService as unknown as LoggingService,
        findOne,
      );
      prisma.project.findUnique.mockResolvedValueOnce(BASE_PROJECT);
      resourceAccess.assertCanRead.mockResolvedValueOnce(undefined);
      prisma.project.update.mockResolvedValueOnce({
        ...BASE_PROJECT,
        status: 'ARCHIVED',
        archivedAt: new Date(),
      });

      await uc.execute('project-1', { status: 'ARCHIVED' }, admin);
      expect(prisma.project.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'ARCHIVED' }),
        }),
      );
    });
  });

  describe('RemoveProjectUseCase', () => {
    it('idempotente — não rearquiva o que já foi arquivado', async () => {
      const uc = new RemoveProjectUseCase(
        prisma as unknown as PrismaService,
        loggingService as unknown as LoggingService,
        findOne,
      );
      const archived = { ...BASE_PROJECT, archivedAt: new Date() };
      prisma.project.findUnique.mockResolvedValueOnce(archived);
      resourceAccess.assertCanRead.mockResolvedValueOnce(undefined);

      const result = await uc.execute('project-1', admin);
      expect(result.archivedAt).not.toBeNull();
      expect(prisma.project.update).not.toHaveBeenCalled();
    });
  });

  describe('GetBoardUseCase', () => {
    it('devolve milestones com tasks ordenadas', async () => {
      const uc = new GetBoardUseCase(
        prisma as unknown as PrismaService,
        findOne,
      );
      prisma.project.findUnique.mockResolvedValueOnce(BASE_PROJECT);
      resourceAccess.assertCanRead.mockResolvedValueOnce(undefined);
      prisma.projectMilestone.findMany.mockResolvedValueOnce([
        { id: 'm1', title: 'Backlog', position: 0, tasks: [] },
      ]);

      const result = await uc.execute('project-1', admin);
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Backlog');
    });
  });

  describe('CreateMilestoneUseCase', () => {
    it('posição é max+1', async () => {
      const uc = new CreateMilestoneUseCase(
        prisma as unknown as PrismaService,
        loggingService as unknown as LoggingService,
        findOne,
      );
      prisma.project.findUnique.mockResolvedValueOnce(BASE_PROJECT);
      resourceAccess.assertCanRead.mockResolvedValueOnce(undefined);
      prisma.projectMilestone.aggregate.mockResolvedValueOnce({
        _max: { position: 2 },
      });
      prisma.projectMilestone.create.mockResolvedValueOnce({
        id: 'm1',
        title: 'Done',
        position: 3,
      });

      const result = await uc.execute('project-1', { title: 'Done' }, admin);
      expect(result.position).toBe(3);
    });
  });

  describe('MoveTaskUseCase', () => {
    it('lança 404 quando task não pertence ao projeto', async () => {
      const uc = new MoveTaskUseCase(
        prisma as unknown as PrismaService,
        i18n as unknown as I18nService,
        findOne,
      );
      prisma.project.findUnique.mockResolvedValueOnce(BASE_PROJECT);
      resourceAccess.assertCanRead.mockResolvedValueOnce(undefined);
      prisma.projectTask.findFirst.mockResolvedValueOnce(null);

      await expect(
        uc.execute('project-1', 'bad-task', { milestoneId: 'm1', position: 0 }, admin),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
