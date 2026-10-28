import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CreateRoleUseCase } from './create.use-case';
import { PrismaService } from '../../../prisma/prisma.service';

const mockPrisma = {
  role: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
};

describe('CreateRoleUseCase', () => {
  let useCase: CreateRoleUseCase;

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [
        CreateRoleUseCase,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    useCase = mod.get(CreateRoleUseCase);
    vi.clearAllMocks();
  });

  it('cria role global com nome válido', async () => {
    mockPrisma.role.findUnique.mockResolvedValue(null);
    mockPrisma.role.create.mockResolvedValue({ id: 'r1', name: 'MANAGER' });
    await expect(useCase.execute('MANAGER')).resolves.toMatchObject({
      name: 'MANAGER',
    });
  });

  it('bloqueia criação de role com nome reservado ADMIN', async () => {
    await expect(useCase.execute('ADMIN')).rejects.toThrow(BadRequestException);
    expect(mockPrisma.role.findUnique).not.toHaveBeenCalled();
  });

  it('bloqueia criação de role com nome reservado USER', async () => {
    await expect(useCase.execute('USER')).rejects.toThrow(BadRequestException);
  });

  it('lança ConflictException se role já existe', async () => {
    mockPrisma.role.findUnique.mockResolvedValue({ id: 'r2', name: 'MANAGER' });
    await expect(useCase.execute('MANAGER')).rejects.toThrow(ConflictException);
  });
});
