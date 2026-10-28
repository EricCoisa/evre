import 'reflect-metadata';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FeatureFlagController } from './feature-flag.controller';
import { ScopeGuard, API_SCOPE_KEY } from '../../common/guards/scope.guard';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { McpScopes } from '../../domain/api-key/mcp-scopes.const';

/** Fixa quem alcança cada rota, não qual classe de guard está montada. */

type Handler = (...args: never[]) => unknown;

const proto = FeatureFlagController.prototype as unknown as Record<
  string,
  Handler
>;

const roles = (m: string) =>
  Reflect.getMetadata(ROLES_KEY, proto[m]) as string[] | undefined;
const scope = (m: string) =>
  Reflect.getMetadata(API_SCOPE_KEY, proto[m]) as string | undefined;

const WRITES = ['create', 'update', 'remove', 'setRoles'];
const ADMIN_READS = ['findAll', 'findOne'];

describe('FeatureFlagController — superfície de acesso', () => {
  it.each([...WRITES, ...ADMIN_READS])('%s exige ADMIN', (m) => {
    expect(roles(m)).toEqual(['ADMIN']);
  });

  it('/me não exige role — é o próprio usuário lendo as flags dele', () => {
    expect(roles('getForMe')).toBeUndefined();
  });

  // Chave de API lê a lista, mas não escreve. Sem scope declarado o ScopeGuard
  // nega por default — é esse pareamento que mantém a escrita fora do alcance.
  it('findAll é a única rota alcançável por API key', () => {
    expect(scope('findAll')).toBe(McpScopes.FEATURE_FLAGS_READ);
  });

  it.each(WRITES)('%s não declara scope', (m) => {
    expect(scope(m)).toBeUndefined();
  });
});

describe('ScopeGuard — o default-deny que as rotas de escrita dependem', () => {
  const ctx = (authType: string, handler: Handler) =>
    ({
      switchToHttp: () => ({ getRequest: () => ({ authType }) }),
      getHandler: () => handler,
    }) as never;

  const guard = new ScopeGuard(new Reflector());

  it.each(WRITES)('nega API key em %s (endpoint sem scope)', (m) => {
    expect(() => guard.canActivate(ctx('api-key', proto[m]))).toThrow(
      ForbiddenException,
    );
  });

  it.each(WRITES)('deixa passar sessão JWT em %s', (m) => {
    expect(guard.canActivate(ctx('jwt', proto[m]))).toBe(true);
  });
});
