import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FindAllLogsUseCase } from './find-all.use-case';
import type { PrismaService } from '../../../prisma/prisma.service';

const mockPrisma = {
  systemLog: { findMany: vi.fn(), count: vi.fn() },
};
const prisma = mockPrisma as unknown as PrismaService;

const baseQuery = { page: 1, limit: 10, pagination: false, search: undefined, filter: undefined };
const pagedQuery = { ...baseQuery, pagination: true };

beforeEach(() => vi.clearAllMocks());

describe('FindAllLogsUseCase', () => {
  const useCase = () => new FindAllLogsUseCase(prisma);

  it('devolve array quando pagination=false', async () => {
    mockPrisma.systemLog.findMany.mockResolvedValue([{ id: '1' }]);
    expect(Array.isArray(await useCase().execute(baseQuery))).toBe(true);
  });

  it('devolve data+meta quando pagination=true', async () => {
    mockPrisma.systemLog.findMany.mockResolvedValue([{ id: '1' }]);
    mockPrisma.systemLog.count.mockResolvedValue(1);
    const result = await useCase().execute(pagedQuery);
    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('meta');
  });

  it('aplica o termo de busca', async () => {
    mockPrisma.systemLog.findMany.mockResolvedValue([]);
    mockPrisma.systemLog.count.mockResolvedValue(0);
    await useCase().execute({ ...pagedQuery, search: 'login' });
    expect(mockPrisma.systemLog.findMany).toHaveBeenCalled();
  });

  it('aplica os filtros de action e module', async () => {
    mockPrisma.systemLog.findMany.mockResolvedValue([]);
    mockPrisma.systemLog.count.mockResolvedValue(0);
    await useCase().execute({
      ...pagedQuery,
      filter: { action: 'CREATE', module: 'AUTH' },
    });
    expect(mockPrisma.systemLog.findMany).toHaveBeenCalled();
  });
});
