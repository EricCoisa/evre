import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import type { PrismaService } from '../../../prisma/prisma.service';
import { FindSystemRolesUseCase } from './find-system-roles.use-case';
import { DeleteRoleUseCase } from './delete.use-case';
import { CreateRoleUseCase } from './create.use-case';


const mockPrisma = {
  role: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), delete: vi.fn() },
};
const prisma = mockPrisma as unknown as PrismaService;

const systemRole = { id: 'sys-1', name: 'ADMIN', isSystem: true, createdAt: new Date() };
const customRole = { id: 'custom-1', name: 'Reviewer', isSystem: false, createdAt: new Date() };

beforeEach(() => vi.clearAllMocks());

describe('FindSystemRolesUseCase', () => {
  it('devolve só as roles de sistema', async () => {
    mockPrisma.role.findMany.mockResolvedValue([systemRole]);
    await expect(new FindSystemRolesUseCase(prisma).execute()).resolves.toEqual([systemRole]);
    expect(mockPrisma.role.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isSystem: true } }),
    );
  });
});

describe('CreateRoleUseCase', () => {
  // Esta é a regra que o service morto NÃO tinha — e que, por isso, os 6 testes
  // verdes do spec antigo nunca cobriram.
  it.each(['ADMIN', 'USER'])('recusa o nome reservado %s', async (name) => {
    await expect(new CreateRoleUseCase(prisma).execute(name)).rejects.toThrow(BadRequestException);
    expect(mockPrisma.role.findUnique).not.toHaveBeenCalled();
  });

  it('cria quando o nome é único', async () => {
    mockPrisma.role.findUnique.mockResolvedValue(null);
    mockPrisma.role.create.mockResolvedValue(customRole);
    await expect(new CreateRoleUseCase(prisma).execute('Reviewer')).resolves.toMatchObject({
      name: 'Reviewer',
    });
  });
});

describe('DeleteRoleUseCase', () => {
  const useCase = () => new DeleteRoleUseCase(prisma);

  it('lança NotFoundException quando a role não existe', async () => {
    mockPrisma.role.findUnique.mockResolvedValue(null);
    await expect(useCase().execute('missing')).rejects.toThrow(NotFoundException);
  });

  it('lança ForbiddenException ao tentar apagar role de sistema', async () => {
    mockPrisma.role.findUnique.mockResolvedValue(systemRole);
    await expect(useCase().execute('sys-1')).rejects.toThrow(ForbiddenException);
  });

  it('apaga uma role customizada', async () => {
    mockPrisma.role.findUnique.mockResolvedValue(customRole);
    mockPrisma.role.delete.mockResolvedValue(customRole);
    await expect(useCase().execute('custom-1')).resolves.toMatchObject({ id: 'custom-1' });
  });
});
