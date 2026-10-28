import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { vi } from 'vitest';

import { UserRouteAccessController } from './user-route-access.controller';
import { FindAllUserRouteAccessUseCase } from './use-cases/find-all.use-case';
import { FindAllByOneUseCase } from './use-cases/find-all-by-one.use-case';
import { GrantAccessUseCase } from './use-cases/grant-access.use-case';
import { RevokeAccessUseCase } from './use-cases/revoke-access.use-case';
import { RevokeAllAccessUseCase } from './use-cases/revoke-all-access.use-case';
import { CheckAccessUseCase } from './use-cases/check-access.use-case';
import { JwtOrApiKeyAuthGuard } from '../../common/guards/jwt-or-api-key.guard';
import { ScopeGuard } from '../../common/guards/scope.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

const findAll = { execute: vi.fn().mockResolvedValue([]) };
const findByUser = { execute: vi.fn().mockResolvedValue([]) };
const revoke = { execute: vi.fn().mockResolvedValue({ ok: true }) };
const revokeAll = { execute: vi.fn().mockResolvedValue({ count: 2 }) };
const check = { execute: vi.fn().mockResolvedValue(true) };

const allowAsAdmin = {
  canActivate: (ctx: {
    switchToHttp: () => { getRequest: () => { user: unknown } };
  }) => {
    ctx.switchToHttp().getRequest().user = {
      id: 'admin-1',
      roleId: 'role-1',
      roleName: 'ADMIN',
    };
    return true;
  },
};

describe('UserRouteAccessController (roteamento)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      controllers: [UserRouteAccessController],
      providers: [
        { provide: FindAllUserRouteAccessUseCase, useValue: findAll },
        { provide: FindAllByOneUseCase, useValue: findByUser },
        { provide: GrantAccessUseCase, useValue: { execute: vi.fn() } },
        { provide: RevokeAccessUseCase, useValue: revoke },
        { provide: RevokeAllAccessUseCase, useValue: revokeAll },
        { provide: CheckAccessUseCase, useValue: check },
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

  it('GET sem userId lista tudo', async () => {
    await request(app.getHttpServer()).get('/user-route-access').expect(200);

    expect(findAll.execute).toHaveBeenCalled();
    expect(findByUser.execute).not.toHaveBeenCalled();
  });

  it('GET ?userId=... filtra por usuario', async () => {
    await request(app.getHttpServer())
      .get('/user-route-access?userId=u1')
      .expect(200);

    expect(findByUser.execute).toHaveBeenCalledWith('u1', expect.anything());
    expect(findAll.execute).not.toHaveBeenCalled();
  });

  it('GET /me?path=... consulta o acesso e normaliza a barra inicial', async () => {
    await request(app.getHttpServer())
      .get('/user-route-access/me?path=dashboard')
      .expect(200, 'true');

    expect(check.execute).toHaveBeenCalledWith('admin-1', '/dashboard', 'role-1');
  });

  it('GET /me aceita path com barra e subcaminho', async () => {
    await request(app.getHttpServer())
      .get('/user-route-access/me?path=%2Fadmin%2Fusers')
      .expect(200);

    expect(check.execute).toHaveBeenCalledWith(
      'admin-1',
      '/admin/users',
      'role-1',
    );
  });

  it('DELETE /:userId/:routeId revoga um vinculo com 204 e sem corpo', async () => {
    const res = await request(app.getHttpServer())
      .delete('/user-route-access/u1/r1')
      .expect(204);

    expect(res.text).toBe('');

    expect(revoke.execute).toHaveBeenCalledWith('u1', 'r1', 'admin-1');
    expect(revokeAll.execute).not.toHaveBeenCalled();
  });

  it('DELETE ?userId=... devolve 200 com a contagem, nao cai no revoke unitario', async () => {
    const res = await request(app.getHttpServer())
      .delete('/user-route-access?userId=u1')
      .expect(200);

    expect(res.body).toEqual({ count: 2 });

    expect(revokeAll.execute).toHaveBeenCalledWith('u1', 'admin-1');
    expect(revoke.execute).not.toHaveBeenCalled();
  });

  it('DELETE sem userId responde 400 e nao revoga nada', async () => {
    await request(app.getHttpServer()).delete('/user-route-access').expect(400);

    expect(revokeAll.execute).not.toHaveBeenCalled();
  });

  it('GET /me sem path responde 400', async () => {
    await request(app.getHttpServer())
      .get('/user-route-access/me')
      .expect(400);

    expect(check.execute).not.toHaveBeenCalled();
  });
});
