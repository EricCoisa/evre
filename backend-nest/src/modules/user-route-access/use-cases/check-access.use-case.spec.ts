import { CheckAccessUseCase } from './check-access.use-case';
import { PrismaService } from '../../../prisma/prisma.service';

const mockPrisma = {
  user: { findUnique: vi.fn() },
  route: { findMany: vi.fn() },
};

const activeRoute = {
  path: '/dashboard',
  isActive: true,
  userRouteAccesses: [],
  roleRouteAccesses: [{ roleId: 'role-1' }],
};

describe('CheckAccessUseCase', () => {
  let useCase: CheckAccessUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    useCase = new CheckAccessUseCase(mockPrisma as unknown as PrismaService);
  });

  it('com roleId em mãos, não consulta a tabela de usuários', async () => {
    mockPrisma.route.findMany.mockResolvedValue([activeRoute]);

    expect(await useCase.execute('user-1', '/dashboard', 'role-1')).toBe(true);
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.route.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { path: { in: ['/dashboard'] } } }),
    );
  });

  it('roleId null (usuário sem role) filtra por roleId vazio, não por undefined', async () => {
    mockPrisma.route.findMany.mockResolvedValue([activeRoute]);

    // Um `undefined` aqui faria o Prisma ignorar o filtro e devolver TODAS as
    // roleRouteAccesses da rota — usuário sem role herdaria acesso de qualquer role.
    await useCase.execute('user-1', '/dashboard', null);
    const arg = mockPrisma.route.findMany.mock.calls[0][0] as {
      include: { roleRouteAccesses: { where: { roleId: string } } };
    };
    expect(arg.include.roleRouteAccesses.where.roleId).toBe('');
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('sem roleId (AI tools), busca a role no banco', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ roleId: 'role-1' });
    mockPrisma.route.findMany.mockResolvedValue([activeRoute]);

    expect(await useCase.execute('user-1', '/dashboard')).toBe(true);
    expect(mockPrisma.user.findUnique).toHaveBeenCalledOnce();
  });

  it('sem roleId e usuário inexistente, nega', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    expect(await useCase.execute('ghost', '/dashboard')).toBe(false);
    expect(mockPrisma.route.findMany).not.toHaveBeenCalled();
  });

  it('override individual de deny vence o acesso da role', async () => {
    mockPrisma.route.findMany.mockResolvedValue([
      { ...activeRoute, userRouteAccesses: [{ id: 'ura-1', denied: true }] },
    ]);

    expect(await useCase.execute('user-1', '/dashboard', 'role-1')).toBe(false);
  });
});
