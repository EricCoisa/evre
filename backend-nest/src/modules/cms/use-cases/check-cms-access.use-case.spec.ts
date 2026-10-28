import type { PrismaService } from '../../../prisma/prisma.service';
import type { RouteCeilingRegistry } from '../../../common/infrastructure/route-ceiling/route-ceiling.registry';
import { CheckCmsAccessUseCase } from './check-cms-access.use-case';

const mockPrisma = {
  route: { findFirst: vi.fn() },
  role: { findUnique: vi.fn() },
  userRouteAccess: { findFirst: vi.fn() },
  roleRouteAccess: { findFirst: vi.fn() },
};
const mockRouteCeilings = {
  allowedRolesFor: vi.fn().mockReturnValue(['ADMIN', 'MODERATOR']),
};

function makeUseCase(): CheckCmsAccessUseCase {
  return new CheckCmsAccessUseCase(
    mockPrisma as unknown as PrismaService,
    mockRouteCeilings as unknown as RouteCeilingRegistry,
  );
}

describe('CheckCmsAccessUseCase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRouteCeilings.allowedRolesFor.mockReturnValue(['ADMIN', 'MODERATOR']);
  });

  it('devolve false quando a rota /cms não existe', async () => {
    mockPrisma.route.findFirst.mockResolvedValue(null);
    expect(await makeUseCase().execute('u1', 'role-admin')).toBe(false);
  });

  it('devolve false quando o papel está fora do teto, mesmo com RoleRouteAccess', async () => {
    mockPrisma.route.findFirst.mockResolvedValue({ id: 'r1' });
    mockPrisma.role.findUnique.mockResolvedValue({ id: 'role-user', name: 'USER' });
    mockPrisma.roleRouteAccess.findFirst.mockResolvedValue({ roleId: 'role-user' });
    expect(await makeUseCase().execute('u1', 'role-user')).toBe(false);
    expect(mockPrisma.userRouteAccess.findFirst).not.toHaveBeenCalled();
  });

  it('devolve true para MODERATOR dentro do teto com RoleRouteAccess', async () => {
    mockPrisma.route.findFirst.mockResolvedValue({ id: 'r1' });
    mockPrisma.role.findUnique.mockResolvedValue({ id: 'role-mod', name: 'MODERATOR' });
    mockPrisma.roleRouteAccess.findFirst.mockResolvedValue({ roleId: 'role-mod' });
    mockPrisma.userRouteAccess.findFirst.mockResolvedValue(null);
    expect(await makeUseCase().execute('u1', 'role-mod')).toBe(true);
  });

  it('devolve false quando dentro do teto mas sem nenhum vínculo de acesso', async () => {
    mockPrisma.route.findFirst.mockResolvedValue({ id: 'r1' });
    mockPrisma.role.findUnique.mockResolvedValue({ id: 'role-admin', name: 'ADMIN' });
    mockPrisma.roleRouteAccess.findFirst.mockResolvedValue(null);
    mockPrisma.userRouteAccess.findFirst.mockResolvedValue(null);
    expect(await makeUseCase().execute('u1', 'role-admin')).toBe(false);
  });

  it('devolve false quando roleId é nulo e o teto não é vazio, mesmo com UserRouteAccess individual', async () => {
    mockPrisma.route.findFirst.mockResolvedValue({ id: 'r1' });
    mockPrisma.userRouteAccess.findFirst.mockResolvedValue({ userId: 'u1' });
    expect(await makeUseCase().execute('u1', null)).toBe(false);
  });

  it('devolve true via UserRouteAccess individual quando o papel está no teto', async () => {
    mockPrisma.route.findFirst.mockResolvedValue({ id: 'r1' });
    mockPrisma.role.findUnique.mockResolvedValue({ id: 'role-admin', name: 'ADMIN' });
    mockPrisma.roleRouteAccess.findFirst.mockResolvedValue(null);
    mockPrisma.userRouteAccess.findFirst.mockResolvedValue({ userId: 'u1' });
    expect(await makeUseCase().execute('u1', 'role-admin')).toBe(true);
  });

  it('path sem teto registrado (allowedRolesFor devolve []) libera qualquer papel com acesso', async () => {
    mockRouteCeilings.allowedRolesFor.mockReturnValue([]);
    mockPrisma.route.findFirst.mockResolvedValue({ id: 'r1' });
    mockPrisma.userRouteAccess.findFirst.mockResolvedValue({ userId: 'u1' });
    expect(await makeUseCase().execute('u1', null)).toBe(true);
  });
});
