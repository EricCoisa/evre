import { describe, it, expect, vi } from 'vitest';
import { FindAllUserConfigDefinitionsUseCase } from './find-all.use-case';
import type { PrismaService } from '../../../prisma/prisma.service';

function setup() {
  const prisma = {
    userConfigurationDefinition: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
  } as unknown as PrismaService;

  return { useCase: new FindAllUserConfigDefinitionsUseCase(prisma), prisma };
}

describe('FindAllUserConfigDefinitionsUseCase', () => {
  it('searches labelKey and defaultValue case-insensitively', async () => {
    const { useCase, prisma } = setup();

    await useCase.execute({ search: 'theme', page: 1, limit: 10, pagination: true });

    expect(prisma.userConfigurationDefinition.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { labelKey: { contains: 'theme', mode: 'insensitive' } },
            { defaultValue: { contains: 'theme', mode: 'insensitive' } },
          ],
        },
      }),
    );
  });

  it('does not filter when there is no search term', async () => {
    const { useCase, prisma } = setup();

    await useCase.execute({ page: 1, limit: 10, pagination: true });

    expect(prisma.userConfigurationDefinition.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }),
    );
  });
});
