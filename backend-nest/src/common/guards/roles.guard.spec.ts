import { Reflector } from '@nestjs/core';
import { ForbiddenException } from '@nestjs/common';
import { I18nContext } from 'nestjs-i18n';
import type { ExecutionContext } from '@nestjs/common';
import { RolesGuard } from './roles.guard';

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

  const mockI18n = { t: vi.fn((k: string) => k) };

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
    vi.mocked(I18nContext.current).mockReturnValue(mockI18n as never);
  });

  afterEach(() => vi.clearAllMocks());

  it('returns true when no roles decorator is present', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    expect(guard.canActivate(makeContext())).toBe(true);
  });

  it('throws ForbiddenException when roles required but user is absent (with i18n)', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['ADMIN']);
    expect(() => guard.canActivate(makeContext(null))).toThrow(
      ForbiddenException,
    );
  });

  it('throws ForbiddenException when roles required but user is absent (without i18n, uses fallback)', () => {
    vi.mocked(I18nContext.current).mockReturnValue(undefined);
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['ADMIN']);
    expect(() => guard.canActivate(makeContext(null))).toThrow(
      ForbiddenException,
    );
  });

  it('returns true when user has one of the required roles', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['ADMIN', 'USER']);
    expect(guard.canActivate(makeContext({ roleName: 'ADMIN' }))).toBe(true);
  });

  it('throws ForbiddenException when user lacks required role (with i18n)', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['ADMIN']);
    expect(() => guard.canActivate(makeContext({ roleName: 'USER' }))).toThrow(
      ForbiddenException,
    );
    expect(mockI18n.t).toHaveBeenCalled();
  });

  it('throws ForbiddenException when user lacks required role (without i18n, uses fallback)', () => {
    vi.mocked(I18nContext.current).mockReturnValue(undefined);
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['ADMIN']);
    expect(() => guard.canActivate(makeContext({ roleName: 'USER' }))).toThrow(
      ForbiddenException,
    );
  });
});
