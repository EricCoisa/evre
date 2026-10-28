import { Reflector } from '@nestjs/core';
import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { ScopeGuard, API_SCOPE_KEY } from './scope.guard';

const handlerFn = () => undefined;

const makeContext = (req: unknown) =>
  ({
    getHandler: vi.fn().mockReturnValue(handlerFn),
    getClass: vi.fn(),
    switchToHttp: vi.fn().mockReturnValue({
      getRequest: vi.fn().mockReturnValue(req),
    }),
  }) as unknown as ExecutionContext;

describe('ScopeGuard', () => {
  let guard: ScopeGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new ScopeGuard(reflector);
  });

  afterEach(() => vi.clearAllMocks());

  it('deixa requisições JWT passarem mesmo sem scope anotado', () => {
    vi.spyOn(reflector, 'get').mockReturnValue(undefined);
    expect(guard.canActivate(makeContext({ authType: 'jwt' }))).toBe(true);
  });

  it('bloqueia API key em endpoint sem scope (default-deny)', () => {
    vi.spyOn(reflector, 'get').mockReturnValue(undefined);
    expect(() =>
      guard.canActivate(makeContext({ authType: 'api-key' })),
    ).toThrow(ForbiddenException);
  });

  it('bloqueia API key com scope insuficiente', () => {
    vi.spyOn(reflector, 'get').mockReturnValue('users:read');
    expect(() =>
      guard.canActivate(
        makeContext({ authType: 'api-key', apiKeyScopes: ['routes:read'] }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('permite API key com o scope exigido', () => {
    vi.spyOn(reflector, 'get').mockReturnValue('users:read');
    expect(
      guard.canActivate(
        makeContext({ authType: 'api-key', apiKeyScopes: ['users:read'] }),
      ),
    ).toBe(true);
  });

  it('lê o metadata do handler com API_SCOPE_KEY', () => {
    const getSpy = vi.spyOn(reflector, 'get').mockReturnValue('agent:chat');
    guard.canActivate(
      makeContext({ authType: 'api-key', apiKeyScopes: ['agent:chat'] }),
    );
    expect(getSpy).toHaveBeenCalledWith(API_SCOPE_KEY, expect.any(Function));
  });
});
