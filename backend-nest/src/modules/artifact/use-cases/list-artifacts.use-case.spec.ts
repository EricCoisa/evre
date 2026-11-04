import { Test } from '@nestjs/testing';
import { PrismaService } from '../../../prisma/prisma.service';
import { ListArtifactsUseCase } from './list-artifacts.use-case';

const mockPrisma = {
  artifact: { findMany: vi.fn(), count: vi.fn() },
};

describe('ListArtifactsUseCase', () => {
  let useCase: ListArtifactsUseCase;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ListArtifactsUseCase,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    useCase = module.get(ListArtifactsUseCase);

    vi.clearAllMocks();
    mockPrisma.artifact.findMany.mockResolvedValue([]);
    mockPrisma.artifact.count.mockResolvedValue(0);
  });

  it('lista só os artefatos não arquivados, sem paginação quando pagination=false', async () => {
    await useCase.execute({
      page: 1,
      limit: 10,
      pagination: false,
    } as never);

    expect(mockPrisma.artifact.findMany).toHaveBeenCalledWith({
      where: { archivedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    expect(mockPrisma.artifact.count).not.toHaveBeenCalled();
  });

  it('busca por fileName quando search é informado', async () => {
    await useCase.execute({
      page: 1,
      limit: 10,
      pagination: false,
      search: 'demo',
    } as never);

    expect(mockPrisma.artifact.findMany).toHaveBeenCalledWith({
      where: {
        archivedAt: null,
        fileName: { contains: 'demo', mode: 'insensitive' },
      },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('pagina quando pagination=true', async () => {
    mockPrisma.artifact.count.mockResolvedValue(25);

    const result = await useCase.execute({
      page: 2,
      limit: 10,
      pagination: true,
    } as never);

    expect(mockPrisma.artifact.findMany).toHaveBeenCalledWith({
      where: { archivedAt: null },
      orderBy: { createdAt: 'desc' },
      skip: 10,
      take: 10,
    });
    expect(result).toEqual({
      data: [],
      meta: { total: 25, page: 2, limit: 10, totalPages: 3 },
    });
  });
});
