import request from 'supertest';
import { type INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';
import { createTestApp } from './helpers';

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
  const cookies: string[] = res.headers['set-cookie'] as string[];
  const c = cookies?.find((s) => s.startsWith('access_token='));
  return c!.split(';')[0].split('=')[1];
}

describe('Tenant isolation (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let orgAId: string;
  let orgBId: string;
  let userAToken: string;
  let userBToken: string;
  const orgASlug = `e2e-tenant-a-${Date.now()}`;
  const orgBSlug = `e2e-tenant-b-${Date.now()}`;
  const userAEmail = `e2e-tenant-a-user-${Date.now()}@example.com`;
  const userBEmail = `e2e-tenant-b-user-${Date.now()}@example.com`;

  beforeAll(async () => {
    prisma = new PrismaClient();

    const [hashA, hashB] = await Promise.all([
      hashPassword('TenantA@1'),
      hashPassword('TenantB@1'),
    ]);

    // Create orgs
    const [orgA, orgB] = await Promise.all([
      prisma.organization.create({
        data: { name: 'E2E Tenant A', slug: orgASlug },
      }),
      prisma.organization.create({
        data: { name: 'E2E Tenant B', slug: orgBSlug },
      }),
    ]);
    orgAId = orgA.id;
    orgBId = orgB.id;

    // Create users
    const [uA, uB] = await Promise.all([
      prisma.user.create({
        data: {
          email: userAEmail,
          salt: hashA.salt,
          hash: hashA.hash,
          name: 'Tenant A User',
          role: 'USER',
          status: 'ACTIVE',
        },
      }),
      prisma.user.create({
        data: {
          email: userBEmail,
          salt: hashB.salt,
          hash: hashB.hash,
          name: 'Tenant B User',
          role: 'USER',
          status: 'ACTIVE',
        },
      }),
    ]);

    // Get or create Role for membership
    let role = await prisma.role.findFirst({ where: { name: 'MEMBER' } });
    if (!role) role = await prisma.role.create({ data: { name: 'MEMBER' } });

    // Create memberships
    await Promise.all([
      prisma.membership.create({
        data: { userId: uA.id, organizationId: orgAId, roleId: role.id },
      }),
      prisma.membership.create({
        data: { userId: uB.id, organizationId: orgBId, roleId: role.id },
      }),
    ]);

    app = await createTestApp();

    [userAToken, userBToken] = await Promise.all([
      loginAndGetToken(app, userAEmail, 'TenantA@1'),
      loginAndGetToken(app, userBEmail, 'TenantB@1'),
    ]);
  });

  afterAll(async () => {
    await prisma.membership.deleteMany({
      where: { organizationId: { in: [orgAId, orgBId] } },
    });
    await prisma.user.deleteMany({
      where: { email: { in: [userAEmail, userBEmail] } },
    });
    await prisma.organization.deleteMany({
      where: { id: { in: [orgAId, orgBId] } },
    });
    await prisma.$disconnect();
    await app.close();
  });

  // ─── GET /organization/:id ────────────────────────────────────────────────

  describe('GET /api/v1/organization/:id', () => {
    it('user from org A can access org A', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/organization/${orgAId}`)
        .set('Authorization', `Bearer ${userAToken}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(orgAId);
    });

    it('user from org A gets 404 when accessing org B', async () => {
      // ponytail: 404 instead of 403 to avoid confirming org existence
      const res = await request(app.getHttpServer())
        .get(`/api/v1/organization/${orgBId}`)
        .set('Authorization', `Bearer ${userAToken}`);
      expect(res.status).toBe(404);
    });

    it('user from org B can access org B', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/organization/${orgBId}`)
        .set('Authorization', `Bearer ${userBToken}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(orgBId);
    });
  });

  // ─── GET /organization/me ─────────────────────────────────────────────────

  describe('GET /api/v1/organization/me', () => {
    it('user A sees only org A', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/organization/me')
        .set('Authorization', `Bearer ${userAToken}`);
      expect(res.status).toBe(200);
      const ids = res.body.map((o: { id: string }) => o.id);
      expect(ids).toContain(orgAId);
      expect(ids).not.toContain(orgBId);
    });

    it('user B sees only org B', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/organization/me')
        .set('Authorization', `Bearer ${userBToken}`);
      expect(res.status).toBe(200);
      const ids = res.body.map((o: { id: string }) => o.id);
      expect(ids).toContain(orgBId);
      expect(ids).not.toContain(orgAId);
    });
  });
});
