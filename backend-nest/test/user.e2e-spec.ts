import request from 'supertest';
import { type INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';
import { createTestApp } from './helpers';

const ADMIN_EMAIL = 'admin@example.com';
const ADMIN_PASSWORD = 'admin123';

// Creates a test-only USER-role account, cleaned up in afterAll
const TEST_USER_EMAIL = 'e2e-test-user@example.com';

async function hashPassword(
  password: string,
): Promise<{ salt: string; hash: string }> {
  const salt = crypto.randomBytes(32).toString('hex');
  const hash = await new Promise<string>((resolve, reject) => {
    crypto.pbkdf2(password, salt, 25000, 512, 'sha256', (err, key) => {
      if (err) reject(err);
      else resolve(key.toString('hex'));
    });
  });
  return { salt, hash };
}

describe('User (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let adminToken: string;
  let testUserId: string;
  let adminId: string;

  beforeAll(async () => {
    prisma = new PrismaClient();

    // Ensure admin exists (created by seed)
    const admin = await prisma.user.findUnique({
      where: { email: ADMIN_EMAIL },
    });
    if (!admin) throw new Error('Admin user not found — seed may have failed');
    adminId = admin.id;

    // Create a dedicated test user for update/get tests.
    // O papel mora em Role/roleId — User não tem coluna `role`.
    const userRole = await prisma.role.findUnique({ where: { name: 'USER' } });
    if (!userRole) throw new Error('Role USER not found — seed may have failed');

    const { salt, hash } = await hashPassword('UserPass@123');
    const testUser = await prisma.user.upsert({
      where: { email: TEST_USER_EMAIL },
      update: {},
      create: {
        email: TEST_USER_EMAIL,
        salt,
        hash,
        name: 'E2E Test User',
        roleId: userRole.id,
        status: 'ACTIVE',
      },
    });
    testUserId = testUser.id;

    app = await createTestApp();

    // Login as admin to get token
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    adminToken = loginRes.body.tokens.accessToken;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: TEST_USER_EMAIL } });
    await prisma.$disconnect();
    await app.close();
  });

  // ─── GET /api/user ─────────────────────────────────────────────────────────

  describe('GET /api/user', () => {
    it('returns 200 with user list for ADMIN', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/user')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
    });

    it('returns 401 when unauthenticated', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/user');
      expect(res.status).toBe(401);
    });
  });

  // ─── GET /api/user/roles ───────────────────────────────────────────────────

  describe('GET /api/user/roles', () => {
    it('returns 200 with available roles', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/user/roles')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });
  });

  // ─── GET /api/user/status ──────────────────────────────────────────────────

  describe('GET /api/user/status', () => {
    it('returns 200 with available statuses', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/user/status')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  // ─── GET /api/user/profile ─────────────────────────────────────────────────

  describe('GET /api/user/profile', () => {
    it('returns 200 with profile for authenticated user', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/user/profile')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.email).toBe(ADMIN_EMAIL);
    });

    it('returns 401 when unauthenticated', async () => {
      const res = await request(app.getHttpServer()).get(
        '/api/v1/user/profile',
      );
      expect(res.status).toBe(401);
    });
  });

  // ─── GET /api/user/:id ─────────────────────────────────────────────────────

  describe('GET /api/user/:id', () => {
    it('returns 200 with user data for given id', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/user/${adminId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.email).toBe(ADMIN_EMAIL);
    });

    it('returns 404 for non-existent user id', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/user/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });
  });

  // ─── PATCH /api/user/:id ───────────────────────────────────────────────────

  describe('PATCH /api/user/:id', () => {
    it('returns 200 when ADMIN updates a user status', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/user/${testUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'INACTIVE' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('INACTIVE');
    });

    it('returns 401 when unauthenticated', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/user/${testUserId}`)
        .send({ name: 'Unauthorized Change' });

      expect(res.status).toBe(401);
    });
  });
});
