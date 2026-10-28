import request from 'supertest';
import { type INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { createTestApp } from './helpers';

/** Contrato HTTP do módulo de notificação: flag é kill-switch, rotas são sempre escopo "me". */
const PASSWORD = process.env.SEED_USER_PASSWORD ?? 'admin123';

describe('Notification API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let userCookie: string;
  let otherUserCookie: string;
  let userId: string;
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

  const get = (path: string, cookie = userCookie) =>
    request(app.getHttpServer()).get(`/api/v1${path}`).set('Cookie', cookie);
  const patch = (path: string, cookie = userCookie) =>
    request(app.getHttpServer()).patch(`/api/v1${path}`).set('Cookie', cookie);
  const post = (path: string, cookie = userCookie) =>
    request(app.getHttpServer()).post(`/api/v1${path}`).set('Cookie', cookie);

  beforeAll(async () => {
    app = await createTestApp();
    prisma = new PrismaClient();
    userCookie = await login('user@example.com');
    otherUserCookie = await login('admin@example.com');

    const user = await prisma.user.findUniqueOrThrow({
      where: { email: 'user@example.com' },
    });
    userId = user.id;

    const root = await prisma.featureFlag.findUniqueOrThrow({
      where: { key: 'NOTIFICATION' },
    });
    rootFlagWasEnabled = root.enabled;
    await prisma.featureFlag.update({
      where: { key: 'NOTIFICATION' },
      data: { enabled: true },
    });

    await prisma.notification.deleteMany({ where: { type: 'E2E_TEST' } });
  });

  afterAll(async () => {
    await prisma.notification.deleteMany({ where: { type: 'E2E_TEST' } });
    await prisma.featureFlag.update({
      where: { key: 'NOTIFICATION' },
      data: { enabled: rootFlagWasEnabled },
    });
    await prisma.$disconnect();
    await app.close();
  });

  it('DEBUG: estado da flag visto pela app', async () => {
    const res = await get('/feature-flags/me').expect(200);
    console.log('DEBUG flags/me:', JSON.stringify(res.body));
    const dbRow = await prisma.featureFlag.findUniqueOrThrow({ where: { key: 'NOTIFICATION' } });
    console.log('DEBUG db row:', JSON.stringify(dbRow));
  });

  it('responde 401 sem autenticação', async () => {
    await request(app.getHttpServer()).get('/api/v1/notification/me').expect(401);
  });

  it('responde 404 (não 403) quando a flag está desligada — não vaza existência', async () => {
    await prisma.featureFlag.update({
      where: { key: 'NOTIFICATION' },
      data: { enabled: false },
    });

    await get('/notification/me').expect(404);
    await get('/notification/me/unread-count').expect(404);

    await prisma.featureFlag.update({
      where: { key: 'NOTIFICATION' },
      data: { enabled: true },
    });
  });

  describe('fluxo ler → contar → marcar lida → dispensar', () => {
    let recipientId: string;

    it('começa em zero não lidas para quem não tem notificação', async () => {
      const res = await get('/notification/me/unread-count').expect(200);
      expect(res.body).toBe(0);
    });

    it('lista inclui uma notificação criada por outro módulo (via Prisma, não há POST público)', async () => {
      const notification = await prisma.notification.create({
        data: {
          type: 'E2E_TEST',
          title: 'Título E2E',
          message: 'Mensagem E2E',
          recipients: { create: [{ userId }] },
        },
        include: { recipients: true },
      });
      recipientId = notification.recipients[0].id;

      const res = await get('/notification/me').expect(200);
      const item = res.body.data.find((n: { id: string }) => n.id === recipientId);
      expect(item).toMatchObject({ title: 'Título E2E', message: 'Mensagem E2E' });

      const count = await get('/notification/me/unread-count').expect(200);
      expect(count.body).toBe(1);
    });

    it('outro usuário não vê nem altera a notificação de quem não é dele (404)', async () => {
      const count = await get('/notification/me/unread-count', otherUserCookie).expect(200);
      expect(count.body).toBe(0);

      await patch(`/notification/me/${recipientId}/read`, otherUserCookie).expect(404);
    });

    it('marcar como lida zera o contador', async () => {
      await patch(`/notification/me/${recipientId}/read`).expect(200);
      const count = await get('/notification/me/unread-count').expect(200);
      expect(count.body).toBe(0);
    });

    it('dispensar remove da listagem', async () => {
      await patch(`/notification/me/${recipientId}/dismiss`).expect(200);
      const res = await get('/notification/me').expect(200);
      expect(res.body.data.find((n: { id: string }) => n.id === recipientId)).toBeUndefined();
    });

    it('read-all não falha mesmo sem nenhuma pendente', async () => {
      await post('/notification/me/read-all').expect(200);
    });

    it('marcar leitura de id inexistente é 404', async () => {
      await patch('/notification/me/00000000-0000-0000-0000-000000000000/read').expect(404);
    });
  });

  describe('broadcast (roleNames/all) — materialização lazy por usuário', () => {
    afterEach(async () => {
      await prisma.notification.deleteMany({ where: { type: 'E2E_TEST_BROADCAST' } });
    });

    it('audienceAll: nenhum NotificationRecipient é criado no envio, só no primeiro acesso do usuário', async () => {
      const notification = await prisma.notification.create({
        data: {
          type: 'E2E_TEST_BROADCAST',
          title: 'Aviso geral',
          message: 'Para todos',
          audienceAll: true,
        },
      });

      const recipientsBeforeAccess = await prisma.notificationRecipient.findMany({
        where: { notificationId: notification.id },
      });
      expect(recipientsBeforeAccess).toHaveLength(0);

      const count = await get('/notification/me/unread-count').expect(200);
      expect(count.body).toBeGreaterThanOrEqual(1);

      const materialized = await prisma.notificationRecipient.findUnique({
        where: { notificationId_userId: { notificationId: notification.id, userId } },
      });
      expect(materialized).not.toBeNull();
      expect(materialized?.readAt).toBeNull();

      const list = await get('/notification/me').expect(200);
      const item = list.body.data.find((n: { id: string }) => n.id === materialized?.id);
      expect(item).toMatchObject({ title: 'Aviso geral', message: 'Para todos' });

      await patch(`/notification/me/${materialized?.id}/read`).expect(200);
    });

    it('audienceRoleNames: só materializa para usuário cuja role está na lista', async () => {
      const notification = await prisma.notification.create({
        data: {
          type: 'E2E_TEST_BROADCAST',
          title: 'Aviso ADMIN',
          message: 'Só para admins',
          audienceRoleNames: ['ADMIN'],
        },
      });

      // userCookie é de 'user@example.com' (role USER) — não deve materializar para ele.
      await get('/notification/me/unread-count').expect(200);
      const notMaterialized = await prisma.notificationRecipient.findUnique({
        where: { notificationId_userId: { notificationId: notification.id, userId } },
      });
      expect(notMaterialized).toBeNull();

      // otherUserCookie é de 'admin@example.com' (role ADMIN) — materializa.
      await get('/notification/me/unread-count', otherUserCookie).expect(200);
      const adminUser = await prisma.user.findUniqueOrThrow({
        where: { email: 'admin@example.com' },
      });
      const materializedForAdmin = await prisma.notificationRecipient.findUnique({
        where: {
          notificationId_userId: { notificationId: notification.id, userId: adminUser.id },
        },
      });
      expect(materializedForAdmin).not.toBeNull();
    });

    it('mark-all-read materializa pendentes antes de marcar', async () => {
      const notification = await prisma.notification.create({
        data: {
          type: 'E2E_TEST_BROADCAST',
          title: 'Aviso',
          message: 'Mensagem',
          audienceAll: true,
        },
      });

      await post('/notification/me/read-all').expect(200);

      const materialized = await prisma.notificationRecipient.findUnique({
        where: { notificationId_userId: { notificationId: notification.id, userId } },
      });
      expect(materialized?.readAt).not.toBeNull();
    });
  });

  describe('POST /notification/broadcast — composer admin', () => {
    afterEach(async () => {
      await prisma.notification.deleteMany({ where: { type: 'SYSTEM_ANNOUNCEMENT' } });
    });

    it('não-admin recebe 403', async () => {
      await post('/notification/broadcast')
        .send({ title: 'Aviso', message: 'Mensagem', all: true })
        .expect(403);
    });

    it('400 quando não é "all" nem tem roleNames', async () => {
      await post('/notification/broadcast', otherUserCookie)
        .send({ title: 'Aviso', message: 'Mensagem' })
        .expect(400);
    });

    it('admin envia para "all": grava audienceAll, sem materializar na hora', async () => {
      await post('/notification/broadcast', otherUserCookie)
        .send({ title: 'Aviso geral', message: 'Mensagem geral', all: true })
        .expect(201);

      const notification = await prisma.notification.findFirstOrThrow({
        where: { type: 'SYSTEM_ANNOUNCEMENT', title: 'Aviso geral' },
      });
      expect(notification.audienceAll).toBe(true);
      const recipients = await prisma.notificationRecipient.findMany({
        where: { notificationId: notification.id },
      });
      expect(recipients).toHaveLength(0);
    });

    it('admin envia para roleNames: aparece no inbox de quem tem a role', async () => {
      await post('/notification/broadcast', otherUserCookie)
        .send({ title: 'Aviso ADMIN', message: 'Só pra admin', roleNames: ['ADMIN'] })
        .expect(201);

      const list = await get('/notification/me', otherUserCookie).expect(200);
      expect(
        list.body.data.find((n: { title: string }) => n.title === 'Aviso ADMIN'),
      ).toBeDefined();
    });
  });
});
