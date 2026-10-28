import request from 'supertest';
import { type INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { createTestApp } from './helpers';

/** Prova o contrato HTTP da mensageria pelo pipeline real (guards, pipes, filtro de exceção). */
const PASSWORD = process.env.SEED_USER_PASSWORD ?? 'admin123';
const ACTIVE = 'aaaaaaaa-0000-4000-8000-0000000000b1';
const ARCHIVED = 'aaaaaaaa-0000-4000-8000-0000000000b2';
// Prefixo só deste spec: telefone de teste que sobrou de outra execução não pode colidir (unique).
const PHONE_PREFIX = '5597000';

describe('Messaging API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let admin: string;
  let regularUser: string;
  let rootFlagWasEnabled: boolean;

  const login = async (email: string): Promise<string> => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);
    return (res.headers['set-cookie'] as unknown as string[])
      .map((c) => c.split(';')[0])
      .join('; ');
  };

  beforeAll(async () => {
    app = await createTestApp();
    prisma = new PrismaClient();
    admin = await login('admin@example.com');
    regularUser = await login('user@example.com');

    // A flag raiz nasce desligada; restaurada no fim.
    const root = await prisma.featureFlag.findUniqueOrThrow({
      where: { key: 'MESSAGING' },
    });
    rootFlagWasEnabled = root.enabled;
    await prisma.featureFlag.update({
      where: { key: 'MESSAGING' },
      data: { enabled: true },
    });

    await prisma.messagingConversation.deleteMany({
      where: { contact: { phone: { startsWith: PHONE_PREFIX } } },
    });
    await prisma.messagingContact.deleteMany({
      where: { phone: { startsWith: PHONE_PREFIX } },
    });
    await prisma.messagingConnection.deleteMany({
      where: { id: { in: [ACTIVE, ARCHIVED] } },
    });
    await prisma.messagingConnection.create({
      data: {
        id: ACTIVE,
        provider: 'EVOLUTION_API',
        config: {
          baseUrl: 'http://evo.invalido:8080',
          token: 't',
          instance: 'e2e',
        },
      },
    });
    await prisma.messagingConnection.create({
      data: {
        id: ARCHIVED,
        provider: 'EVOLUTION_GO',
        archivedAt: new Date(),
        config: { baseUrl: 'http://go.invalido:8080', token: 't' },
      },
    });
  });

  afterAll(async () => {
    await prisma.messagingConversation.deleteMany({
      where: { contact: { phone: { startsWith: PHONE_PREFIX } } },
    });
    await prisma.messagingContact.deleteMany({
      where: { phone: { startsWith: PHONE_PREFIX } },
    });
    await prisma.messagingConnection.deleteMany({
      where: { id: { in: [ACTIVE, ARCHIVED] } },
    });
    await prisma.featureFlag.update({
      where: { key: 'MESSAGING' },
      data: { enabled: rootFlagWasEnabled },
    });
    await prisma.$disconnect();
    await app.close();
  });

  const get = (path: string, cookie = admin) =>
    request(app.getHttpServer()).get(`/api/v1${path}`).set('Cookie', cookie);

  describe('query inválida é 400, não 500', () => {
    it.each([
      '/messaging/messages?direction=SIDEWAYS',
      '/messaging/messages?limit=5000',
      '/messaging/messages?phone=1&phone=2',
      '/messaging/conversations',
      '/messaging/conversations?phone=',
    ])('%s', async (path) => {
      await get(path).expect(400);
    });

    it('query válida segue 200', async () => {
      await get('/messaging/messages?direction=INBOUND&limit=5').expect(200);
      await get('/messaging/contacts?limit=5').expect(200);
    });
  });

  describe('health da conexão é só do ADMIN', () => {
    it('usuário comum recebe 403; sem login, 401', async () => {
      await get(`/messaging/connections/${ACTIVE}/health`, regularUser).expect(
        403,
      );
      await request(app.getHttpServer())
        .get(`/api/v1/messaging/connections/${ACTIVE}/health`)
        .expect(401);
    });

    it('admin recebe a saúde', async () => {
      const res = await get(`/messaging/connections/${ACTIVE}/health`).expect(
        200,
      );
      expect(res.body).toHaveProperty('operational');
    });
  });

  describe('conexão arquivada não é operável', () => {
    it('não vira padrão (era 500 por violar o CHECK do banco)', async () => {
      await request(app.getHttpServer())
        .put(`/api/v1/messaging/connections/${ARCHIVED}/default`)
        .set('Cookie', admin)
        .expect(400);
      const row = await prisma.messagingConnection.findUniqueOrThrow({
        where: { id: ARCHIVED },
      });
      expect(row.isDefault).toBe(false);
    });

    it('não conecta sessão, não consulta estado e não aceita edição', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/messaging/connections/${ARCHIVED}/session`)
        .set('Cookie', admin)
        .expect(400);
      await get(`/messaging/connections/${ARCHIVED}/session`).expect(400);
      await request(app.getHttpServer())
        .put(`/api/v1/messaging/connections/${ARCHIVED}`)
        .set('Cookie', admin)
        .send({ baseUrl: 'http://go.invalido:8080', token: 'novo' })
        .expect(400);
    });
  });

  describe('inbox de contatos', () => {
    it('ordena pela atividade mais recente e pagina no banco', async () => {
      const base = Date.now();
      for (const [i, minutesAgo] of [30, 5, 60].entries()) {
        const phone = `${PHONE_PREFIX}${String(i).padStart(4, '0')}`;
        const lastMessageAt = new Date(base - minutesAgo * 60_000);
        const contact = await prisma.messagingContact.create({
          data: { phone, profileSyncedAt: new Date(), lastMessageAt },
        });
        await prisma.messagingConversation.create({
          data: { connectionId: ACTIVE, contactId: contact.id, lastMessageAt },
        });
      }

      const res = await get(
        `/messaging/contacts?connectionId=${ACTIVE}&limit=2&page=1`,
      ).expect(200);

      expect(res.body.meta).toMatchObject({
        total: 3,
        limit: 2,
        totalPages: 2,
      });
      expect(res.body.data.map((c: { phone: string }) => c.phone)).toEqual([
        `${PHONE_PREFIX}0001`, // 5 min atrás
        `${PHONE_PREFIX}0000`, // 30 min atrás
      ]);
    });
  });
});
