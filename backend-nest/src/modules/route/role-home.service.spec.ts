import { describe, it, expect, vi } from 'vitest';
import { RoleHomeService } from './role-home.service';
import { parseRoleHomeMap } from 'src/domain/route/role-home.const';

function build(stored: string | null, grants: Array<[string, string]> = []) {
  const systemConfig = {
    getValueOrNull: vi.fn().mockResolvedValue(stored),
    setManyByLabelKey: vi.fn().mockResolvedValue(undefined),
  };
  const prisma = {
    roleRouteAccess: {
      findMany: vi.fn().mockResolvedValue(
        grants.map(([name, routeId]) => ({ routeId, role: { name } })),
      ),
    },
  };
  return {
    service: new RoleHomeService(systemConfig as never, prisma as never),
    systemConfig,
    prisma,
  };
}

describe('parseRoleHomeMap', () => {
  it('aceita JSON em string', () => {
    expect(parseRoleHomeMap('{"ADMIN":"r1"}')).toEqual({ ADMIN: 'r1' });
  });

  it('JSON quebrado vira mapa vazio', () => {
    expect(parseRoleHomeMap('{nao json')).toEqual({});
  });

  it('array não é mapa de role', () => {
    expect(parseRoleHomeMap('["r1"]')).toEqual({});
  });

  it('descarta entrada cujo valor não é id', () => {
    expect(parseRoleHomeMap('{"ADMIN":"r1","USER":null,"X":""}')).toEqual({ ADMIN: 'r1' });
  });
});

describe('RoleHomeService', () => {
  it('routeIdFor devolve a rota da role', async () => {
    const { service } = build('{"ADMIN":"r1","USER":"r2"}');
    expect(await service.routeIdFor('USER')).toBe('r2');
  });

  it('role sem entrada devolve null — quem resolve decide o fallback', async () => {
    const { service } = build('{"ADMIN":"r1"}');
    expect(await service.routeIdFor('SUPORTE')).toBeNull();
  });

  it('roleName ausente devolve null', async () => {
    const { service } = build('{"ADMIN":"r1"}');
    expect(await service.routeIdFor(null)).toBeNull();
  });

  it('save descarta role que aponta para rota inexistente', async () => {
    const { service, systemConfig } = build(null, [['ADMIN', 'r1']]);

    const saved = await service.save({ ADMIN: 'r1', USER: 'apagada' }, 'user-1');

    expect(saved).toEqual({ ADMIN: 'r1' });
    expect(systemConfig.setManyByLabelKey).toHaveBeenCalledWith(
      [expect.objectContaining({ value: '{"ADMIN":"r1"}' })],
      'user-1',
    );
  });

  it('save recusa rota que existe mas a role não alcança', async () => {
    // r2 existe e é home de ADMIN, mas USER não tem grant para ela.
    const { service } = build(null, [['ADMIN', 'r2']]);

    const saved = await service.save({ ADMIN: 'r2', USER: 'r2' }, 'user-1');

    expect(saved).toEqual({ ADMIN: 'r2' });
  });

  it('save com mapa vazio não consulta grants e grava vazio', async () => {
    const { service, systemConfig, prisma } = build(null);

    const saved = await service.save({}, 'user-1');

    expect(saved).toEqual({});
    expect(prisma.roleRouteAccess.findMany).not.toHaveBeenCalled();
    expect(systemConfig.setManyByLabelKey).toHaveBeenCalledWith(
      [expect.objectContaining({ value: '{}' })],
      'user-1',
    );
  });
});
