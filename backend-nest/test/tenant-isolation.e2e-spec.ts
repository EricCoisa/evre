import request from 'supertest';
import { type INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';
import { createTestApp } from './helpers';
import { ResourceAccessService } from 'src/common/infrastructure/resource-access/resource-access.service';
import type { AuthenticatedUser } from 'src/common/types/auth.types';

const ADMIN_EMAIL = 'admin@example.com';
const ADMIN_PASSWORD = 'admin123';

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

// Isolamento por recurso (Company via Membership), não por tenant separado — não existe
// model Organization neste schema. Ver docs/architecture/data-model.md.
describe('Tenant isolation (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let resourceAccess: ResourceAccessService;
  let companyAId: string;
  let companyBId: string;
  let userAId: string;
  let userBId: string;
  let moderatorToken: string;
  let adminToken: string;
  const userAEmail = `e2e-tenant-a-user-${Date.now()}@example.com`;
  const userBEmail = `e2e-tenant-b-user-${Date.now()}@example.com`;
  const moderatorEmail = `e2e-tenant-moderator-${Date.now()}@example.com`;
  const MODERATOR_PASSWORD = 'ModeratorPass@1';

  beforeAll(async () => {
    prisma = new PrismaClient();

    const userRole = await prisma.role.findUnique({ where: { name: 'USER' } });
    if (!userRole) throw new Error('Role USER not found — seed may have failed');
    const moderatorRole = await prisma.role.findUnique({
      where: { name: 'MODERATOR' },
    });
    if (!moderatorRole)
      throw new Error('Role MODERATOR not found — seed may have failed');

    const [companyA, companyB] = await Promise.all([
      prisma.company.create({ data: { name: 'E2E Tenant Company A' } }),
      prisma.company.create({ data: { name: 'E2E Tenant Company B' } }),
    ]);
    companyAId = companyA.id;
    companyBId = companyB.id;

    const [hashA, hashB, hashModerator] = await Promise.all([
      hashPassword('TenantA@1'),
      hashPassword('TenantB@1'),
      hashPassword(MODERATOR_PASSWORD),
    ]);

    const [userA, userB] = await Promise.all([
      prisma.user.create({
        data: {
          email: userAEmail,
          salt: hashA.salt,
          hash: hashA.hash,
          name: 'Tenant A User',
          roleId: userRole.id,
          status: 'ACTIVE',
        },
      }),
      prisma.user.create({
        data: {
          email: userBEmail,
          salt: hashB.salt,
          hash: hashB.hash,
          name: 'Tenant B User',
          roleId: userRole.id,
          status: 'ACTIVE',
        },
      }),
      prisma.user.create({
        data: {
          email: moderatorEmail,
          salt: hashModerator.salt,
          hash: hashModerator.hash,
          name: 'E2E Moderator',
          roleId: moderatorRole.id,
          status: 'ACTIVE',
        },
      }),
    ]);
    userAId = userA.id;
    userBId = userB.id;

    // Membership real, cada usuário só com vínculo na própria empresa.
    await Promise.all([
      prisma.membership.create({
        data: { userId: userAId, companyId: companyAId },
      }),
      prisma.membership.create({
        data: { userId: userBId, companyId: companyBId },
      }),
    ]);

    app = await createTestApp();
    resourceAccess = app.get(ResourceAccessService);

    [adminToken, moderatorToken] = await Promise.all([
      loginAndGetToken(app, ADMIN_EMAIL, ADMIN_PASSWORD),
      loginAndGetToken(app, moderatorEmail, MODERATOR_PASSWORD),
    ]);
  });

  afterAll(async () => {
    await prisma.membership.deleteMany({
      where: { companyId: { in: [companyAId, companyBId] } },
    });
    await prisma.user.deleteMany({
      where: { email: { in: [userAEmail, userBEmail, moderatorEmail] } },
    });
    await prisma.company.deleteMany({
      where: { id: { in: [companyAId, companyBId] } },
    });
    await prisma.$disconnect();
    await app.close();
  });

  // ─── Isolamento real via ResourceAccessService (app real, banco real) ──────
  //
  // GET /company/:id é roles: ['ADMIN']-only (F0-04/T6): RolesGuard devolve 403 para
  // não-ADMIN antes mesmo de chegar no ResourceAccessService, então um não-ADMIN nunca
  // alcança essa rota via HTTP hoje. O caso de IDOR por recurso é exercitado direto no
  // service, resolvido do container de DI do app real — mesma técnica que todo outro
  // E2E deste pacote já usa, só pulando o controller.
  describe('ResourceAccessService isolation (direto do DI, sem rota HTTP)', () => {
    function asUser(id: string): AuthenticatedUser {
      return { id, email: '', roleId: null, roleName: 'USER' };
    }

    it('membership de A alcança a empresa A', async () => {
      await expect(
        resourceAccess.assertCanRead(asUser(userAId), {
          companyId: companyAId,
        }),
      ).resolves.toBeUndefined();
    });

    it('membership de A NÃO alcança a empresa B (404, não-existência não é confirmada)', async () => {
      await expect(
        resourceAccess.assertCanRead(asUser(userAId), {
          companyId: companyBId,
        }),
      ).rejects.toThrow();
    });

    it('membership de B alcança a empresa B mas não a A', async () => {
      await expect(
        resourceAccess.assertCanRead(asUser(userBId), {
          companyId: companyBId,
        }),
      ).resolves.toBeUndefined();
      await expect(
        resourceAccess.assertCanRead(asUser(userBId), {
          companyId: companyAId,
        }),
      ).rejects.toThrow();
    });

    it('scopeFilter de A restringe a companyA, nunca inclui companyB', async () => {
      const filter = await resourceAccess.scopeFilter(asUser(userAId));

      expect(filter).toBeDefined();
      const companyBranch = filter?.OR.find(
        (clause) => 'companyId' in clause,
      ) as { companyId: { in: string[] } } | undefined;
      expect(companyBranch?.companyId.in).toContain(companyAId);
      expect(companyBranch?.companyId.in).not.toContain(companyBId);
    });
  });

  // ─── Contrato HTTP: a rota e o guard continuam funcionando ─────────────────

  describe('GET /api/v1/company/:id (contrato HTTP)', () => {
    it('ADMIN autenticado lê uma empresa real → 200', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/company/${companyAId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(companyAId);
    });

    // Regressão de camada de rota (RolesGuard), não o caso de IDOR por recurso:
    // confirma que a rota segue ADMIN-only e nega MODERATOR antes do ResourceAccessService.
    it('MODERATOR autenticado recebe 403 do RolesGuard, não chega no ResourceAccessService', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/company/${companyAId}`)
        .set('Authorization', `Bearer ${moderatorToken}`);
      expect(res.status).toBe(403);
    });
  });
});
