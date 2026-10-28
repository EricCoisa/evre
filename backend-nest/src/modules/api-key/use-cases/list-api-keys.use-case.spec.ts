import { ListApiKeysUseCase } from './list-api-keys.use-case';

const mockPrisma = {
  apiKey: { findMany: vi.fn() },
};

describe('ListApiKeysUseCase', () => {
  let useCase: ListApiKeysUseCase;

  beforeEach(() => {
    useCase = new ListApiKeysUseCase(mockPrisma as never);
    vi.clearAllMocks();
    mockPrisma.apiKey.findMany.mockResolvedValue([]);
  });

  it('não-admin vê apenas as próprias chaves, sem dados do usuário', async () => {
    await useCase.execute('u1', false);

    expect(mockPrisma.apiKey.findMany).toHaveBeenCalledWith({
      where: { userId: 'u1' },
      omit: { keyHash: true },
      include: undefined,
      orderBy: { createdAt: 'desc' },
    });
  });

  it('admin vê todas as chaves com usuário dono', async () => {
    await useCase.execute('u1', true);

    expect(mockPrisma.apiKey.findMany).toHaveBeenCalledWith({
      where: undefined,
      omit: { keyHash: true },
      include: { user: { select: { id: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });
  });
});
