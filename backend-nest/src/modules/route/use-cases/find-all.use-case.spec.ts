import { Test } from '@nestjs/testing';
import { FindAllRoutesUseCase } from './find-all.use-case';
import { PrismaService } from 'src/prisma/prisma.service';

const routes = [
  {
    id: 'r1',
    path: '/dashboard',
    labelKey: 'ROUTE_DASHBOARD',
    ordem: 1,
    showSideBar: true,
    isClientHome: false,
    parent: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const mockPrisma = {
  route: {
    findMany: vi.fn().mockResolvedValue(routes),
    count: vi.fn().mockResolvedValue(1),
  },
};

describe('FindAllRoutesUseCase', () => {
  let useCase: FindAllRoutesUseCase;

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [
        FindAllRoutesUseCase,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    useCase = mod.get(FindAllRoutesUseCase);
    vi.clearAllMocks();
    mockPrisma.route.findMany.mockResolvedValue(routes);
    mockPrisma.route.count.mockResolvedValue(1);
  });

  it('busca por path e labelKey — nunca por `label`, que não existe no model', async () => {
    await useCase.execute({ page: 1, limit: 10, pagination: false, search: 'dash' });

    const where = mockPrisma.route.findMany.mock.calls[0][0].where as {
      OR: Record<string, unknown>[];
    };
    expect(Object.keys(Object.assign({}, ...where.OR)).sort()).toEqual([
      'labelKey',
      'path',
    ]);
  });

  it('não filtra quando não há search', async () => {
    await useCase.execute({ page: 1, limit: 10, pagination: false });

    expect(mockPrisma.route.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }),
    );
  });

  it('devolve PaginatedResponse quando pagination=true', async () => {
    const result = (await useCase.execute({
      page: 2,
      limit: 5,
      pagination: true,
    })) as { meta: { total: number; totalPages: number } };

    expect(mockPrisma.route.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 5, take: 5 }),
    );
    expect(result.meta.total).toBe(1);
  });
});
