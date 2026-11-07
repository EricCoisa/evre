import { Reflector } from '@nestjs/core';
import { ForbiddenException } from '@nestjs/common';
import { I18nContext } from 'nestjs-i18n';
import type { ExecutionContext } from '@nestjs/common';
import { RolesGuard } from './roles.guard';
import type { CheckAccessUseCase } from 'src/modules/user-route-access/use-cases/check-access.use-case';

vi.mock('nestjs-i18n', async () => {
  const actual =
    await vi.importActual<typeof import('nestjs-i18n')>('nestjs-i18n');
  return { ...actual, I18nContext: { current: vi.fn() } };
});

const makeContext = (user: unknown = null) =>
  ({
    getHandler: vi.fn(),
    getClass: vi.fn(),
    switchToHttp: vi.fn().mockReturnValue({
      getRequest: vi.fn().mockReturnValue({ user }),
    }),
  }) as unknown as ExecutionContext;

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;
  let mockCheckAccess: { execute: ReturnType<typeof vi.fn> };

  const mockI18n = { t: vi.fn((k: string) => k) };

  beforeEach(() => {
    reflector = new Reflector();
    mockCheckAccess = { execute: vi.fn().mockResolvedValue(true) };
    guard = new RolesGuard(reflector, mockCheckAccess as unknown as CheckAccessUseCase);
    vi.mocked(I18nContext.current).mockReturnValue(mockI18n as never);
  });

  afterEach(() => vi.clearAllMocks());

  it('returns true when no roles decorator is present', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    await expect(guard.canActivate(makeContext())).resolves.toBe(true);
  });

  it('throws ForbiddenException when roles required but user is absent (with i18n)', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['ADMIN']);
    await expect(guard.canActivate(makeContext(null))).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('throws ForbiddenException when roles required but user is absent (without i18n, uses fallback)', async () => {
    vi.mocked(I18nContext.current).mockReturnValue(undefined);
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['ADMIN']);
    await expect(guard.canActivate(makeContext(null))).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('returns true when user has one of the required roles (ADMIN skips route check)', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['ADMIN', 'USER']);
    await expect(guard.canActivate(makeContext({ roleName: 'ADMIN' }))).resolves.toBe(true);
    expect(mockCheckAccess.execute).not.toHaveBeenCalled();
  });

  it('throws ForbiddenException when user lacks required role (with i18n)', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['ADMIN']);
    await expect(guard.canActivate(makeContext({ roleName: 'USER' }))).rejects.toThrow(
      ForbiddenException,
    );
    expect(mockI18n.t).toHaveBeenCalled();
  });

  it('throws ForbiddenException when user lacks required role (without i18n, uses fallback)', async () => {
    vi.mocked(I18nContext.current).mockReturnValue(undefined);
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['ADMIN']);
    await expect(guard.canActivate(makeContext({ roleName: 'USER' }))).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('checks route access via RouteAccess for non-ADMIN and denies when revoked', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === 'roles') return ['ADMIN', 'MODERATOR'];
      if (key === 'route_access_path') return '/company';
      return undefined;
    });
    mockCheckAccess.execute.mockResolvedValue(false);

    await expect(
      guard.canActivate(makeContext({ id: 'u1', roleName: 'MODERATOR', roleId: 'r1' })),
    ).rejects.toThrow(ForbiddenException);
    expect(mockCheckAccess.execute).toHaveBeenCalledWith('u1', '/company', 'r1');
  });

  it('allows non-ADMIN when route access is granted via RouteAccess', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === 'roles') return ['ADMIN', 'MODERATOR'];
      if (key === 'route_access_path') return '/company';
      return undefined;
    });
    mockCheckAccess.execute.mockResolvedValue(true);

    await expect(
      guard.canActivate(makeContext({ id: 'u1', roleName: 'MODERATOR', roleId: 'r1' })),
    ).resolves.toBe(true);
    expect(mockCheckAccess.execute).toHaveBeenCalledWith('u1', '/company', 'r1');
  });
});
