import request from 'supertest';
import { type INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createTestApp } from './helpers';

const ADMIN_EMAIL = 'admin@example.com';
const ADMIN_PASSWORD = 'admin123';
const USER_EMAIL = 'e2e-artifact-user@example.com';
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

describe('Artifact (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let adminToken: string;
  let userToken: string;
  const createdArtifactIds: string[] = [];

  beforeAll(async () => {
    prisma = new PrismaClient();
    const { salt, hash } = await hashPassword(USER_PASSWORD);
    const userRole = await prisma.role.findUnique({ where: { name: 'USER' } });
    if (!userRole) throw new Error('Role USER not found — seed may have failed');
    await prisma.user.upsert({
      where: { email: USER_EMAIL },
      update: {},
      create: {
        email: USER_EMAIL,
        salt,
        hash,
        name: 'Artifact E2E User',
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
    await prisma.artifact.deleteMany({ where: { id: { in: createdArtifactIds } } });
    await prisma.user.deleteMany({ where: { email: USER_EMAIL } });
    await prisma.$disconnect();
    await app.close();
  });

  describe('POST /api/v1/artifacts', () => {
    it('sem auth → 401', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/artifacts')
        .attach('file', Buffer.from('<html></html>'), 'demo.html');
      expect(res.status).toBe(401);
    });

    it('role USER → 403', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/artifacts')
        .set('Authorization', `Bearer ${userToken}`)
        .attach('file', Buffer.from('<html></html>'), 'demo.html');
      expect(res.status).toBe(403);
    });

    it('arquivo único (html) → 201, kind FILE', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/artifacts')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', Buffer.from('<html><body>e2e</body></html>'), 'demo.html');

      expect(res.status).toBe(201);
      expect(res.body.kind).toBe('FILE');
      expect(res.body.storageKey).toMatch(/\.html$/);
      createdArtifactIds.push(res.body.id);
    });

    it('pasta (.zip com index.html + style.css) → 201, kind FOLDER', async () => {
      const zipBuffer = fs.readFileSync(
        path.join(__dirname, 'fixtures', 'site.zip'),
      );

      const res = await request(app.getHttpServer())
        .post('/api/v1/artifacts')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', zipBuffer, 'site.zip');

      expect(res.status).toBe(201);
      expect(res.body.kind).toBe('FOLDER');
      expect(res.body.entryFileName).toBe('index.html');
      expect(res.body.files).toHaveLength(2);
      createdArtifactIds.push(res.body.id);

      // Wildcard `:id/view/*path` — primeiro precedente de rota wildcard do repo (Express 5).
      const viewRoot = await request(app.getHttpServer())
        .get(`/api/v1/artifacts/${res.body.id}/view`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(viewRoot.status).toBe(302);
      expect(viewRoot.headers.location).toContain('index.html');

      const viewSub = await request(app.getHttpServer())
        .get(`/api/v1/artifacts/${res.body.id}/view/style.css`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(viewSub.status).toBe(302);
      expect(viewSub.headers.location).toContain('style.css');

      // Path fora do manifesto (path traversal já fechado por unit test dedicado) → 404.
      const viewOutsideManifest = await request(app.getHttpServer())
        .get(`/api/v1/artifacts/${res.body.id}/view/nao-existe.txt`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(viewOutsideManifest.status).toBe(404);
    });
  });

  describe('GET /api/v1/artifacts/:id/view', () => {
    let fileArtifactId: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/artifacts')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', Buffer.from('<html></html>'), 'view-demo.html');
      fileArtifactId = res.body.id;
      createdArtifactIds.push(fileArtifactId);
    });

    it('sem auth → 401', async () => {
      const res = await request(app.getHttpServer()).get(
        `/api/v1/artifacts/${fileArtifactId}/view`,
      );
      expect(res.status).toBe(401);
    });

    it('role USER → 403', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/artifacts/${fileArtifactId}/view`)
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(403);
    });

    it('ADMIN → 302 com Location setado', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/artifacts/${fileArtifactId}/view`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(302);
      expect(res.headers.location).toBeTruthy();
    });
  });

  describe('DELETE /api/v1/artifacts/:id', () => {
    it('arquiva sem apagar a linha', async () => {
      const upload = await request(app.getHttpServer())
        .post('/api/v1/artifacts')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', Buffer.from('<html></html>'), 'archive-demo.html');
      const id = upload.body.id;
      createdArtifactIds.push(id);

      const res = await request(app.getHttpServer())
        .delete(`/api/v1/artifacts/${id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.archivedAt).toBeTruthy();

      const row = await prisma.artifact.findUnique({ where: { id } });
      expect(row).not.toBeNull();
      expect(row?.storageKey).toBe(upload.body.storageKey);
    });
  });
});
