import request from 'supertest';
import { type INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';
import { createTestApp } from './helpers';

const ADMIN_EMAIL = 'admin@example.com';
const ADMIN_PASSWORD = 'admin123';
const USER_EMAIL = 'e2e-authz-user@example.com';
const USER_PASSWORD = 'UserPass@1';

async function hashPassword(password: string) {
  const salt = crypto.randomBytes(32).toString('hex');
  const hash = await new Promise<string>((resolve, reject) => {
    crypto.pbkdf2(password, salt, 25000, 512, 'sha256', (err, key) => {
      if (err) reject(err);
      else resolve(key.toString('hex'));
    });
  });
  return { salt, hash };
}

async function loginAndGetToken(
  app: INestApplication,
  email: string,
  password: string,
) {
  const res = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ email, password });
  if (res.status !== 200)
    throw new Error(`Login failed for ${email}: ${res.status}`);
  const cookies = res.headers['set-cookie'] as unknown as string[];
  const c = cookies?.find((s) => s.startsWith('access_token='));
  if (!c) throw new Error('No access_token cookie');
  return c.split(';')[0].split('=')[1];
}

describe('Authorization matrix (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let adminToken: string;
  let userToken: string;

  beforeAll(async () => {
    prisma = new PrismaClient();
    const { salt, hash } = await hashPassword(USER_PASSWORD);
    // O papel mora em Role/roleId — User não tem coluna `role`.
    const userRole = await prisma.role.findUnique({ where: { name: 'USER' } });
    if (!userRole) throw new Error('Role USER not found — seed may have failed');
    await prisma.user.upsert({
      where: { email: USER_EMAIL },
      update: {},
      create: {
        email: USER_EMAIL,
        salt,
        hash,
        name: 'AuthZ E2E User',
        roleId: userRole.id,
        status: 'ACTIVE',
      },
    });
    app = await createTestApp();
    [adminToken, userToken] = await Promise.all([
      loginAndGetToken(app, ADMIN_EMAIL, ADMIN_PASSWORD),
      loginAndGetToken(app, USER_EMAIL, USER_PASSWORD),
    ]);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: USER_EMAIL } });
    await prisma.$disconnect();
    await app.close();
  });

  // ─── Platform-admin-only endpoints ────────────────────────────────────────

  describe('GET /api/v1/user (platformAdmin)', () => {
    it('PLATFORM_ADMIN → 200', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/user')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
    });

    it('USER → 403', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/user')
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(403);
    });

    it('unauthenticated → 401', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/user');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/role-route-access (platformAdmin)', () => {
    it('PLATFORM_ADMIN → 200', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/role-route-access')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
    });

    it('USER → 403', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/role-route-access')
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(403);
    });
  });

  // ─── Self-only endpoints ──────────────────────────────────────────────────

  describe('GET /api/v1/auth/me (any authenticated)', () => {
    it('PLATFORM_ADMIN → 200', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
    });

    it('USER → 200', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(200);
    });
  });
});
