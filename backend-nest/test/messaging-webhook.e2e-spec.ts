import request from 'supertest';
import { type INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { configCacheKey } from 'src/domain/system-configuration/system-configuration.const';
import { RedisService } from 'src/common/infrastructure/redis/redis.service';
import { createTestApp } from './helpers';

/** Os caminhos de rejeição do webhook: chave errada, assinatura errada e reenvio duplicado. */
const WEBHOOK = '/api/v1/messaging/webhook';
const KEY = 'chave-de-teste-e2e';
const SECRET = 'segredo-webhook-e2e';
const PHONE = '5511987654321';
const CONNECTION_ID = '00000000-0000-4000-8000-0000000000e2';
let connectionId = CONNECTION_ID;
const KEY_LABEL = 'SYSTEM_MESSAGING_WEBHOOK_KEY';

function upsertEvent(id: string, text = 'oi') {
  return {
    event: 'messages.upsert',
    data: {
      key: { remoteJid: `${PHONE}@s.whatsapp.net`, fromMe: false, id },
      pushName: 'Fulano E2E',
      message: { conversation: text },
      messageTimestamp: 1728000000,
    },
  };
}

describe('Messaging webhook (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let redis: RedisService;

  /** A config é lida pelo cache do Redis; gravar direto no banco não o invalida. */
  const dropKeyCache = () => redis.del(configCacheKey(KEY_LABEL));

  beforeAll(async () => {
    app = await createTestApp();
    redis = app.get(RedisService);
    prisma = new PrismaClient();

    await prisma.systemConfiguration.upsert({
      where: { labelKey: 'SYSTEM_MESSAGING_WEBHOOK_KEY' },
      update: { value: KEY, secret: false },
      create: {
        labelKey: 'SYSTEM_MESSAGING_WEBHOOK_KEY',
        value: KEY,
        valueType: 'STRING',
        secret: false,
      },
    });
    await dropKeyCache();
    // A conexão é do banco, não do system config: credenciais ficam em `config` (JSON por provider).
    const connection = await prisma.messagingConnection.upsert({
      where: { id: CONNECTION_ID },
      update: {},
      create: {
        id: CONNECTION_ID,
        provider: 'EVOLUTION_API',
        config: {
          baseUrl: 'http://evo.invalido:8080',
          token: 'tok',
          instance: 'e2e',
          webhookSecret: SECRET,
        },
      },
    });
    connectionId = connection.id;
  });

  afterAll(async () => {
    await prisma.messagingMessage.deleteMany({ where: { connectionId } });
    await prisma.messagingConversation.deleteMany({ where: { connectionId } });
    await prisma.messagingContact.deleteMany({ where: { phone: PHONE } });
    await prisma.messagingConnection.deleteMany({
      where: { id: connectionId },
    });
    await dropKeyCache();
    await prisma.$disconnect();
    await app.close();
  });

  const auth = { authorization: `Bearer ${SECRET}` };

  it('sem chave na URL responde 401', async () => {
    await request(app.getHttpServer())
      .post(WEBHOOK)
      .set(auth)
      .send(upsertEvent('no-key'))
      .expect(401);
  });

  it('chave errada responde 401', async () => {
    await request(app.getHttpServer())
      .post(`${WEBHOOK}?key=errada&connection=${CONNECTION_ID}`)
      .set(auth)
      .send(upsertEvent('bad-key'))
      .expect(401);
  });

  // Camada 1: a chave da URL passa, mas a assinatura nativa do provider não.
  it('chave certa e Bearer errado responde 401', async () => {
    await request(app.getHttpServer())
      .post(`${WEBHOOK}?key=${KEY}&connection=${CONNECTION_ID}`)
      .set({ authorization: 'Bearer errado' })
      .send(upsertEvent('bad-sig'))
      .expect(401);
  });

  // `application/json` inválido é recusado pelo body-parser global, antes do controller: 400.
  it('JSON quebrado declarado como application/json responde 400, não 500', async () => {
    await request(app.getHttpServer())
      .post(`${WEBHOOK}?key=${KEY}&connection=${CONNECTION_ID}`)
      .set({ ...auth, 'content-type': 'application/json' })
      .send('isto nao e json')
      .expect(400);
  });

  // Fora do body-parser (outro content-type) quem recusa é o use-case: 401, nunca 500.
  it('corpo que não é JSON em outro content-type responde 401, não 500', async () => {
    await request(app.getHttpServer())
      .post(`${WEBHOOK}?key=${KEY}&connection=${CONNECTION_ID}`)
      .set({ ...auth, 'content-type': 'text/plain' })
      .send('isto nao e json')
      .expect(401);
  });

  // O corte da chave acontece ANTES de o corpo ser lido: aqui o limite do parser é o padrão (100 KB),
  // então um corpo de 300 KB sem chave só devolve 401 (e não 413) se o portão rodou primeiro.
  it('sem chave, um corpo enorme é recusado com 401 sem ser lido', async () => {
    await request(app.getHttpServer())
      .post(`${WEBHOOK}?connection=${CONNECTION_ID}`)
      .set({ ...auth, 'content-type': 'application/json' })
      .send(JSON.stringify({ lixo: 'x'.repeat(300 * 1024) }))
      .expect(401);
  });

  // Sem chave configurada o endpoint não tem como autenticar ninguém: recusa tudo (falha fechada).
  it('sem chave configurada o webhook recusa até quem manda tudo certo', async () => {
    const original = await prisma.systemConfiguration.findUniqueOrThrow({
      where: { labelKey: KEY_LABEL },
    });
    try {
      await prisma.systemConfiguration.update({
        where: { labelKey: KEY_LABEL },
        data: { value: '' },
      });
      await dropKeyCache();

      await request(app.getHttpServer())
        .post(`${WEBHOOK}?connection=${CONNECTION_ID}`)
        .set(auth)
        .send(upsertEvent('sem-chave'))
        .expect(401);
      await request(app.getHttpServer())
        .post(`${WEBHOOK}?key=&connection=${CONNECTION_ID}`)
        .set(auth)
        .send(upsertEvent('sem-chave'))
        .expect(401);
      expect(
        await prisma.messagingMessage.count({
          where: { providerMessageId: 'sem-chave' },
        }),
      ).toBe(0);
    } finally {
      await prisma.systemConfiguration.update({
        where: { labelKey: KEY_LABEL },
        data: { value: original.value },
      });
      await dropKeyCache();
    }
  });

  it('nenhuma rejeição gravou mensagem no banco', async () => {
    const count = await prisma.messagingMessage.count({
      where: { contact: { phone: PHONE } },
    });
    expect(count).toBe(0);
  });

  it('chave e assinatura corretas são aceitas', async () => {
    const res = await request(app.getHttpServer())
      .post(`${WEBHOOK}?key=${KEY}&connection=${CONNECTION_ID}`)
      .set(auth)
      .send(upsertEvent('ok-1'))
      .expect(200);

    expect(res.body).toEqual({ accepted: true });
  });

  // Reenvio é regra, não exceção: a Meta reenvia por design.
  it('replay do mesmo providerMessageId não duplica linha', async () => {
    const { MessagingService } =
      await import('../src/modules/messaging/messaging.service');
    const service = app.get(MessagingService);

    await service.ingest(connectionId, upsertEvent('replay-1', 'primeira'));
    await service.ingest(connectionId, upsertEvent('replay-1', 'segunda'));

    const rows = await prisma.messagingMessage.findMany({
      where: { providerMessageId: 'replay-1' },
    });
    expect(rows).toHaveLength(1);
    // Upsert com `update: {}` — o reenvio não sobrescreve o que já estava.
    expect(rows[0].text).toBe('primeira');
    expect(rows[0].direction).toBe('INBOUND');
  });

  it('inbound de remetente novo cria o contato automaticamente', async () => {
    const contact = await prisma.messagingContact.findUnique({
      where: { phone: PHONE },
    });
    expect(contact).not.toBeNull();
    expect(contact?.pushName).toBe('Fulano E2E');
  });

  it('handshake com chave errada responde 403', async () => {
    await request(app.getHttpServer())
      .get(`${WEBHOOK}?key=errada&hub.mode=subscribe&hub.challenge=123`)
      .expect(403);
  });
});
