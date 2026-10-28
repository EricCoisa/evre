import { Test } from '@nestjs/testing';
import { FindAllUsersUseCase } from './find-all-users.use-case';
import { PrismaService } from 'src/prisma/prisma.service';

const users = [
  {
    id: 'u1',
    email: 'a@b.com',
    name: 'Test',
    role: 'USER',
    status: 'ACTIVE',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];
const mockPrisma = {
  user: {
    findMany: vi.fn().mockResolvedValue(users),
    count: vi.fn().mockResolvedValue(1),
  },
};

describe('FindAllUsersUseCase', () => {
  let useCase: FindAllUsersUseCase;

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [
        FindAllUsersUseCase,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    useCase = mod.get(FindAllUsersUseCase);
    vi.clearAllMocks();
    mockPrisma.user.findMany.mockResolvedValue(users);
    mockPrisma.user.count.mockResolvedValue(1);
  });

  it('retorna lista sem paginação quando pagination=false', async () => {
    const result = await useCase.execute({
      page: 1,
      limit: 10,
      pagination: false,
    });

    expect(mockPrisma.user.count).not.toHaveBeenCalled();
    expect(Array.isArray(result)).toBe(true);
  });

  it('retorna PaginatedResponse quando pagination=true', async () => {
    const result = (await useCase.execute({
      page: 1,
      limit: 10,
      pagination: true,
    })) as any;

    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('meta');
    expect(result.meta.total).toBe(1);
    expect(result.meta.totalPages).toBe(1);
  });

  it('aplica filtro de search no where', async () => {
    await useCase.execute({
      page: 1,
      limit: 10,
      pagination: false,
      search: 'test',
    });

    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ OR: expect.any(Array) }),
      }),
    );
  });

  it('aplica filtro de role no where', async () => {
    await useCase.execute({
      page: 1,
      limit: 10,
      pagination: false,
      filter: { role: 'ADMIN' },
    });

    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ roleRecord: { name: 'ADMIN' } }),
      }),
    );
  });

  it('calcula skip corretamente para página 2', async () => {
    await useCase.execute({ page: 2, limit: 5, pagination: true });

    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 5, take: 5 }),
    );
  });
});
