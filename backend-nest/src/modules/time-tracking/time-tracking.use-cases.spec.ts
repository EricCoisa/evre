import { describe, it, expect, vi } from 'vitest';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { StartTimerUseCase } from './use-cases/start-timer.use-case';
import { StopTimerUseCase } from './use-cases/stop-timer.use-case';
import { GetActiveTimerUseCase } from './use-cases/get-active-timer.use-case';
import { UpdateTimeEntryUseCase } from './use-cases/update-time-entry.use-case';
import { ListTimeEntriesUseCase } from './use-cases/list-time-entries.use-case';
import { ExportTimeEntriesUseCase } from './use-cases/export-time-entries.use-case';
import type { PrismaService } from 'src/prisma/prisma.service';
import type { SystemConfigurationService } from 'src/modules/system-configuration/system-configuration.service';
import type { LoggingService } from 'src/modules/logging/logging.service';

describe('TimeTracking Use Cases', () => {
  describe('StartTimerUseCase', () => {
    it('stops currently active timer and creates a new one atomically', async () => {
      const activeTimer = {
        id: 'timer-1',
        userId: 'u1',
        startTime: new Date(Date.now() - 60000), // 1 min atrás
        endTime: null,
      };

      const updateMock = vi.fn().mockResolvedValue({ ...activeTimer, endTime: new Date(), duration: 60 });
      const createMock = vi.fn().mockResolvedValue({
        id: 'timer-2',
        userId: 'u1',
        description: 'New Task',
        startTime: new Date(),
        endTime: null,
      });

      const tx = {
        timeEntry: {
          findFirst: vi.fn().mockResolvedValue(activeTimer),
          update: updateMock,
          create: createMock,
        },
      };

      const prisma = {
        $transaction: vi.fn().mockImplementation((cb) => cb(tx)),
      } as unknown as PrismaService;

      const useCase = new StartTimerUseCase(prisma);
      const result = await useCase.execute('u1', { description: 'New Task', isBillable: true });

      expect(tx.timeEntry.findFirst).toHaveBeenCalledWith({
        where: { userId: 'u1', endTime: null },
      });
      expect(updateMock).toHaveBeenCalled();
      expect(createMock).toHaveBeenCalled();
      expect(result.id).toBe('timer-2');
    });
  });

  describe('StopTimerUseCase', () => {
    it('throws NotFoundException if no active timer is running', async () => {
      const prisma = {
        timeEntry: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      } as unknown as PrismaService;

      const useCase = new StopTimerUseCase(prisma);
      await expect(useCase.execute('u1')).rejects.toThrow(NotFoundException);
    });

    it('stops the active timer and calculates duration in seconds', async () => {
      const startTime = new Date(Date.now() - 120000); // 120 segundos
      const activeTimer = {
        id: 'timer-1',
        userId: 'u1',
        startTime,
        endTime: null,
      };

      const prisma = {
        timeEntry: {
          findFirst: vi.fn().mockResolvedValue(activeTimer),
          update: vi.fn().mockImplementation(({ data }) => ({ ...activeTimer, ...data })),
        },
      } as unknown as PrismaService;

      const useCase = new StopTimerUseCase(prisma);
      const result = await useCase.execute('u1');

      expect(result.endTime).toBeDefined();
      expect(result.duration).toBeGreaterThanOrEqual(119);
    });
  });

  describe('GetActiveTimerUseCase', () => {
    it('identifies forgotten timer when elapsed hours exceed threshold', async () => {
      const nineHoursAgo = new Date(Date.now() - 9 * 3600 * 1000);
      const activeTimer = {
        id: 'timer-old',
        userId: 'u1',
        startTime: nineHoursAgo,
        endTime: null,
      };

      const prisma = {
        timeEntry: {
          findFirst: vi.fn().mockResolvedValue(activeTimer),
        },
      } as unknown as PrismaService;

      const sysConfig = {
        getValueOrNull: vi.fn().mockResolvedValue('8'),
      } as unknown as SystemConfigurationService;

      const useCase = new GetActiveTimerUseCase(prisma, sysConfig);
      const result = await useCase.execute('u1');

      expect(result.entry?.id).toBe('timer-old');
      expect(result.isForgotten).toBe(true);
      expect(result.thresholdHours).toBe(8);
    });
  });

  describe('UpdateTimeEntryUseCase', () => {
    it('updates entry, marks isManual: true and logs audit event', async () => {
      const existing = {
        id: 't-1',
        userId: 'u1',
        startTime: new Date('2026-01-01T10:00:00Z'),
        endTime: new Date('2026-01-01T11:00:00Z'),
        duration: 3600,
        isManual: false,
      };

      const prisma = {
        timeEntry: {
          findUnique: vi.fn().mockResolvedValue(existing),
          update: vi.fn().mockImplementation(({ data }) => ({ ...existing, ...data })),
        },
      } as unknown as PrismaService;

      const logging = {
        create: vi.fn().mockResolvedValue(undefined),
      } as unknown as LoggingService;

      const useCase = new UpdateTimeEntryUseCase(prisma, logging);
      const user = { id: 'u1', roleName: 'MODERATOR', email: 'mod@example.com' } as any;

      const result = await useCase.execute(
        't-1',
        {
          startTime: '2026-01-01T10:00:00Z',
          endTime: '2026-01-01T12:00:00Z', // 2 horas = 7200s
        },
        user,
      );

      expect(result.duration).toBe(7200);
      expect(result.isManual).toBe(true);
      expect(result.editedById).toBe('u1');
      expect(logging.create).toHaveBeenCalledWith(
        expect.objectContaining({
          module: 'TIME_TRACKING',
          action: 'UPDATE',
        }),
        'u1',
      );
    });

    it('forbids non-admin user from editing someone elses entry', async () => {
      const existing = { id: 't-1', userId: 'other-user' };
      const prisma = {
        timeEntry: {
          findUnique: vi.fn().mockResolvedValue(existing),
        },
      } as unknown as PrismaService;
      const logging = { create: vi.fn() } as unknown as LoggingService;

      const useCase = new UpdateTimeEntryUseCase(prisma, logging);
      const user = { id: 'u1', roleName: 'MODERATOR' } as any;

      await expect(useCase.execute('t-1', {}, user)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('ListTimeEntriesUseCase', () => {
    it('returns filtered items and aggregates both totalSeconds and unfiltered currentMonthSeconds', async () => {
      const prisma = {
        timeEntry: {
          findMany: vi.fn()
            .mockResolvedValueOnce([{ id: 'item-1', startTime: new Date(), endTime: new Date(), duration: 1800 }])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([]),
          count: vi.fn().mockResolvedValue(1),
          aggregate: vi.fn()
            .mockResolvedValueOnce({ _sum: { duration: 1800 } })
            .mockResolvedValueOnce({ _sum: { duration: 36000 } }),
        },
      } as unknown as PrismaService;

      const sysConfig = {
        getValueOrNull: vi.fn().mockResolvedValue('8'),
      } as unknown as SystemConfigurationService;

      const useCase = new ListTimeEntriesUseCase(prisma, sysConfig);
      const user = { id: 'u1', roleName: 'ADMIN' } as any;

      const result = await useCase.execute({ page: 1, limit: 20 }, user);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].isForgotten).toBe(false);
      expect(result.meta.totalSeconds).toBe(1800);
      expect(result.meta.currentMonthSeconds).toBe(36000);
      expect(result.meta.thresholdHours).toBe(8);
    });

    it('marks completed and running entries exceeding threshold hours as isForgotten', async () => {
      const nineHoursAgo = new Date(Date.now() - 9 * 3600 * 1000);
      const prisma = {
        timeEntry: {
          findMany: vi.fn()
            .mockResolvedValueOnce([
              { id: 'item-1', startTime: new Date(), endTime: new Date(), duration: 10 * 3600 },
              { id: 'item-2', startTime: nineHoursAgo, endTime: null, duration: null },
            ])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([]),
          count: vi.fn().mockResolvedValue(2),
          aggregate: vi.fn()
            .mockResolvedValueOnce({ _sum: { duration: 36000 } })
            .mockResolvedValueOnce({ _sum: { duration: 36000 } }),
        },
      } as unknown as PrismaService;

      const sysConfig = {
        getValueOrNull: vi.fn().mockResolvedValue('8'),
      } as unknown as SystemConfigurationService;

      const useCase = new ListTimeEntriesUseCase(prisma, sysConfig);
      const user = { id: 'u1', roleName: 'ADMIN' } as any;

      const result = await useCase.execute({ page: 1, limit: 20 }, user);

      expect(result.data).toHaveLength(2);
      expect(result.data[0].isForgotten).toBe(true);
      expect(result.data[1].isForgotten).toBe(true);
    });

    it('resolves startDate and endDate from JSON filter or top-level params', async () => {
      const prisma = {
        timeEntry: {
          findMany: vi.fn()
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([]),
          count: vi.fn().mockResolvedValue(0),
          aggregate: vi.fn()
            .mockResolvedValueOnce({ _sum: { duration: 0 } })
            .mockResolvedValueOnce({ _sum: { duration: 0 } }),
        },
      } as unknown as PrismaService;

      const sysConfig = {
        getValueOrNull: vi.fn().mockResolvedValue('8'),
      } as unknown as SystemConfigurationService;

      const useCase = new ListTimeEntriesUseCase(prisma, sysConfig);
      const user = { id: 'u1', roleName: 'ADMIN' } as any;

      await useCase.execute(
        {
          page: 1,
          limit: 20,
          filter: JSON.stringify({
            startDate: '2026-10-01T00:00:00.000Z',
            endDate: '2026-10-31',
          }),
        },
        user,
      );

      expect(prisma.timeEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            startTime: expect.objectContaining({
              gte: new Date('2026-10-01T00:00:00.000Z'),
              lte: expect.any(Date),
            }),
          }),
        }),
      );
    });
  });

  describe('ExportTimeEntriesUseCase', () => {
    it('generates CSV with BOM, headers and formatted lines', async () => {
      const mockItems = [
        {
          id: 'item-1',
          startTime: new Date('2026-11-01T10:00:00Z'),
          endTime: new Date('2026-11-01T12:30:00Z'),
          duration: 9000, // 2h 30m
          isBillable: true,
          source: 'TIMER',
          isManual: false,
          description: 'Desenvolvimento do relatório; com ponto e vírgula',
          entityType: 'TASK',
          entityTitle: 'Tarefa 1',
          project: { id: 'p1', name: 'Projeto Alpha' },
          user: { id: 'u1', name: 'Carlos Dev', email: 'carlos@example.com' },
          editedBy: null,
          editedById: null,
        },
      ];

      const prisma = {
        timeEntry: {
          findMany: vi.fn().mockResolvedValue(mockItems),
        },
      } as unknown as PrismaService;

      const sysConfig = {
        getValueOrNull: vi.fn().mockResolvedValue('8'),
      } as unknown as SystemConfigurationService;

      const useCase = new ExportTimeEntriesUseCase(prisma, sysConfig);
      const user = { id: 'u1', roleName: 'ADMIN' } as any;

      const result = await useCase.execute(
        {
          startDate: '2026-11-01T00:00:00Z',
          endDate: '2026-11-30T23:59:59Z',
        },
        user,
      );

      expect(result.csv).toContain('\uFEFF');
      expect(result.csv).toContain('Data;Início;Término;Duração (Formatada);Duração (Horas);Projeto');
      expect(result.csv).not.toContain(';Faturável;');
      expect(result.csv).toContain('02:30:00');
      expect(result.csv).toContain('2,50');
      expect(result.csv).toContain('"Desenvolvimento do relatório; com ponto e vírgula"');
      expect(result.csv).toContain('Projeto Alpha');
      expect(result.totalEntries).toBe(1);
      expect(result.totalSeconds).toBe(9000);
      expect(result.billableSeconds).toBe(9000);
      expect(result.filename).toMatch(/relatorio-tempo-2026-11-01-a-2026-11-30\.csv/);
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0]).toMatchObject({
        projectName: 'Projeto Alpha',
        durationFormatted: '02:30:00',
        durationHours: '2,50',
        userName: 'Carlos Dev',
        isBillable: true,
      });
      expect(result.period).toEqual({
        startDate: '2026-11-01',
        endDate: '2026-11-30',
      });
    });

    it('throws BadRequestException when period is not defined', async () => {
      const prisma = { timeEntry: { findMany: vi.fn() } } as any;
      const sysConfig = { getValueOrNull: vi.fn().mockResolvedValue('8') } as any;
      const useCase = new ExportTimeEntriesUseCase(prisma, sysConfig);
      const user = { id: 'u1', roleName: 'ADMIN' } as any;

      await expect(useCase.execute({}, user)).rejects.toThrowError(
        /É obrigatório definir a data inicial e final para exportação/,
      );
    });

    it('throws BadRequestException when period exceeds 90 days', async () => {
      const prisma = { timeEntry: { findMany: vi.fn() } } as any;
      const sysConfig = { getValueOrNull: vi.fn().mockResolvedValue('8') } as any;
      const useCase = new ExportTimeEntriesUseCase(prisma, sysConfig);
      const user = { id: 'u1', roleName: 'ADMIN' } as any;

      await expect(
        useCase.execute(
          {
            startDate: '2026-01-01T00:00:00Z',
            endDate: '2026-05-01T00:00:00Z',
          },
          user,
        ),
      ).rejects.toThrowError(/excede o limite máximo permitido de 90 dias/);
    });
  });
});
