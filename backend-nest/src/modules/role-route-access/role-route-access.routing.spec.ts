import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { vi } from 'vitest';

import { RoleRouteAccessController } from './role-route-access.controller';
import { FindAllRoleRouteAccessUseCase } from './use-cases/find-all.use-case';
import { FindOneRoleRouteAccessUseCase } from './use-cases/find-one.use-case';
import { CreateRoleRouteAccessUseCase } from './use-cases/create.use-case';
import { RemoveRoleRouteAccessUseCase } from './use-cases/remove.use-case';
import { FindAllUserRoleUseCase } from './use-cases/find-all-user-role.use-case';
import { FindByRoleUseCase } from './use-cases/find-by-role.use-case';
import { RemoveByRoleUseCase } from './use-cases/remove-by-role.use-case';
import { JwtOrApiKeyAuthGuard } from '../../common/guards/jwt-or-api-key.guard';
import { ScopeGuard } from '../../common/guards/scope.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

const remove = { execute: vi.fn().mockResolvedValue({ ok: true }) };
const findOne = { execute: vi.fn().mockResolvedValue({ ok: true }) };
const findByRole = { execute: vi.fn().mockResolvedValue([]) };
const removeByRole = { execute: vi.fn().mockResolvedValue({ count: 3 }) };

const allowAsAdmin = {
  canActivate: (ctx: { switchToHttp: () => { getRequest: () => { user: unknown } } }) => {
    ctx.switchToHttp().getRequest().user = { id: 'admin-1', roleName: 'ADMIN' };
    return true;
  },
};

const stub = () => ({ execute: vi.fn().mockResolvedValue([]) });

describe('RoleRouteAccessController (roteamento)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      controllers: [RoleRouteAccessController],
      providers: [
        { provide: FindAllRoleRouteAccessUseCase, useValue: stub() },
        { provide: FindOneRoleRouteAccessUseCase, useValue: findOne },
        { provide: CreateRoleRouteAccessUseCase, useValue: stub() },
        { provide: RemoveRoleRouteAccessUseCase, useValue: remove },
        { provide: FindAllUserRoleUseCase, useValue: stub() },
        { provide: FindByRoleUseCase, useValue: findByRole },
        { provide: RemoveByRoleUseCase, useValue: removeByRole },
      ],
    })
      .overrideGuard(JwtOrApiKeyAuthGuard)
      .useValue(allowAsAdmin)
      .overrideGuard(ScopeGuard)
      .useValue(allowAsAdmin)
      .overrideGuard(RolesGuard)
      .useValue(allowAsAdmin)
      .compile();

    app = mod.createNestApplication();
    await app.init();
  });

  afterAll(() => app.close());
  beforeEach(() => vi.clearAllMocks());

  it('DELETE ?roleId=... chama removeByRole, nao remove', async () => {
    await request(app.getHttpServer())
      .delete('/role-route-access?roleId=role-1')
      .expect(200);

    expect(removeByRole.execute).toHaveBeenCalledWith('role-1', 'admin-1');
    expect(remove.execute).not.toHaveBeenCalled();
  });

  it('DELETE /:roleId/:routeId continua chamando remove, com 204 e sem corpo', async () => {
    const res = await request(app.getHttpServer())
      .delete('/role-route-access/role-1/route-1')
      .expect(204);

    expect(res.text).toBe('');

    expect(remove.execute).toHaveBeenCalledWith('admin-1', 'role-1', 'route-1');
    expect(removeByRole.execute).not.toHaveBeenCalled();
  });

  it('GET /role/:roleId chama findByRole, nao findOne', async () => {
    await request(app.getHttpServer())
      .get('/role-route-access/role/role-1')
      .expect(200);

    expect(findByRole.execute).toHaveBeenCalled();
    expect(findOne.execute).not.toHaveBeenCalled();
  });

  it('DELETE sem roleId responde 400 e nao apaga nada', async () => {
    await request(app.getHttpServer()).delete('/role-route-access').expect(400);
    expect(removeByRole.execute).not.toHaveBeenCalled();
  });
});
