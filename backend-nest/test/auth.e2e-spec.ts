import request from 'supertest';
import { type INestApplication } from '@nestjs/common';
import { createTestApp } from './helpers';
import { RedisService } from '../src/common/infrastructure/redis/redis.service';

// Uses admin@example.com / admin123 seeded by vitest-global-setup → prisma seed
const ADMIN_EMAIL = 'admin@example.com';
const ADMIN_PASSWORD = 'admin123';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;

  beforeAll(async () => {
    const cache = new Map<string, string>();
    const redis = {
      get: async (key: string) => cache.get(key) ?? null,
      set: async (key: string, value: string) => {
        cache.set(key, value);
      },
      del: async (key: string) => {
        cache.delete(key);
      },
      increment: async () => {},
      sadd: async () => {},
      scard: async () => 0,
      setnx: async () => true,
      publish: async () => {},
      subscribe: async () => {},
      onModuleDestroy: async () => {},
    };
    app = await createTestApp([{ token: RedisService, value: redis }]);
  });

  afterAll(async () => {
    await app.close();
  });

  // ─── POST /api/auth/login ──────────────────────────────────────────────────

  describe('POST /api/auth/login', () => {
    it('returns 200 and sets HttpOnly cookies on valid credentials', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe(ADMIN_EMAIL);
      // tokens are in HttpOnly cookies, not in body (card 4.9)
      expect(res.body.tokens).toBeUndefined();
      const cookies: string[] = res.headers['set-cookie'] as string[];
      const accessCookie = cookies?.find((c) => c.startsWith('access_token='));
      expect(accessCookie).toBeDefined();
      accessToken = accessCookie!.split(';')[0].split('=')[1];
    });

    it('returns 401 on wrong password', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: ADMIN_EMAIL, password: 'wrong-password' });

      expect(res.status).toBe(401);
    });

    it('returns 401 for non-existent user', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'ghost@example.com', password: 'any' });

      expect(res.status).toBe(401);
    });
  });

  // ─── GET /api/auth/me ──────────────────────────────────────────────────────

  describe('GET /api/auth/me', () => {
    it('returns 200 with user info when authenticated', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.email).toBe(ADMIN_EMAIL);
    });

    it('returns 401 when unauthenticated', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/auth/me');
      expect(res.status).toBe(401);
    });
  });

  // ─── POST /api/auth/logout ─────────────────────────────────────────────────

  describe('POST /api/auth/logout', () => {
    it('returns 200 when authenticated (no refresh cookie needed)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
    });

    it('returns 401 when unauthenticated', async () => {
      const res = await request(app.getHttpServer()).post(
        '/api/v1/auth/logout',
      );
      expect(res.status).toBe(401);
    });
  });

  // ─── POST /api/auth/refresh ────────────────────────────────────────────────

  describe('POST /api/auth/refresh', () => {
    it('returns 401 when no refresh token cookie is present', async () => {
      const res = await request(app.getHttpServer()).post(
        '/api/v1/auth/refresh',
      );
      expect(res.status).toBe(401);
    });
  });

  // ─── OAuth ─────────────────────────────────────────────────────────────────
  // A flag OAUTH_LOGIN é semeada enabled e sem roles — é isso que faz o
  // FeatureFlagGuard liberar a rota para quem ainda não está autenticado.

  describe('GET /api/auth/oauth/providers', () => {
    it('responde sem autenticação com a flag ligada', async () => {
      const res = await request(app.getHttpServer()).get(
        '/api/v1/auth/oauth/providers',
      );

      expect(res.status).toBe(200);
      expect(res.body).toEqual([
        { id: 'GOOGLE', label: 'Google', configured: false, enabled: true },
        {
          id: 'MICROSOFT',
          label: 'Microsoft',
          configured: false,
          enabled: true,
        },
      ]);
    });
  });

  describe('POST /api/auth/oauth/:provider/authorize-url', () => {
    it('retorna 404 para provider sem credenciais configuradas', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/oauth/GOOGLE/authorize-url')
        .send({ intent: 'LOGIN' });
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/auth/oauth/callback', () => {
    it('retorna 401 para state forjado', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/oauth/callback')
        .send({ code: 'fake-code', state: 'not-a-jwt' });

      expect(res.status).toBe(401);
    });
  });
});
