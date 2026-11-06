import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { MessagingController } from './messaging.controller';
import { FeatureFlagService } from '../feature-flag/feature-flag.service';
import { CheckAccessUseCase } from '../user-route-access/use-cases/check-access.use-case';
import { SendMessageUseCase } from './use-cases/send-message.use-case';
import { SendPresenceUseCase } from './use-cases/send-presence.use-case';
import { GetCapabilitiesUseCase } from './use-cases/get-capabilities.use-case';
import { CheckConnectionHealthUseCase } from './use-cases/check-health.use-case';
import { ListConnectionsUseCase } from './use-cases/list-connections.use-case';
import { CreateConnectionUseCase } from './use-cases/create-connection.use-case';
import { UpdateConnectionUseCase } from './use-cases/update-connection.use-case';
import { SetDefaultConnectionUseCase } from './use-cases/set-default-connection.use-case';
import { ArchiveConnectionUseCase } from './use-cases/archive-connection.use-case';
import { ListMessagesUseCase } from './use-cases/list-messages.use-case';
import { GetMessageMediaUseCase } from './use-cases/get-message-media.use-case';
import { GetContactPhotoUseCase } from './use-cases/get-contact-photo.use-case';
import { MessagingEventsService } from './messaging-events.service';
import { ReceiveWebhookUseCase } from './use-cases/receive-webhook.use-case';
import { VerifyWebhookChallengeUseCase } from './use-cases/verify-challenge.use-case';
import { MessagingSessionUseCase } from './use-cases/session.use-case';
import { ListContactsUseCase } from './use-cases/list-contacts.use-case';
import { CreateContactUseCase } from './use-cases/create-contact.use-case';
import { UpdateContactUseCase } from './use-cases/update-contact.use-case';
import { ListConversationsUseCase } from './use-cases/list-conversations.use-case';
import { RestoreConnectionUseCase } from './use-cases/restore-connection.use-case';

/** Ordem do enum `RequestMethod` do Nest — DELETE vem ANTES de PATCH. */
const VERBS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] as const;

/** Assinatura de rota declarada, na ordem em que o Nest casa (ordem de declaração). */
function routes(): Array<{ verb: string; path: string; segments: number }> {
  const proto = MessagingController.prototype as unknown as Record<
    string,
    unknown
  >;
  return Object.getOwnPropertyNames(proto)
    .filter((name) => name !== 'constructor')
    .map((name) => {
      const handler = proto[name] as object;
      const path = Reflect.getMetadata(PATH_METADATA, handler) as string;
      const method = Reflect.getMetadata(METHOD_METADATA, handler) as number;
      return {
        verb: VERBS[method] ?? String(method),
        path,
        segments: path.split('/').filter(Boolean).length,
      };
    });
}

describe('MessagingController', () => {
  let controller: MessagingController;
  const sendMessageUseCase = { execute: vi.fn().mockResolvedValue('msg-1') };
  const sendPresenceUseCase = { execute: vi.fn() };
  const getCapabilitiesUseCase = { execute: vi.fn() };
  const listConnections = { execute: vi.fn() };
  const createConnection = { execute: vi.fn() };
  const restoreConnection = { execute: vi.fn() };
  const updateConnection = { execute: vi.fn() };
  const setDefault = { execute: vi.fn() };
  const archiveConnection = { execute: vi.fn() };
  const checkHealth = { execute: vi.fn() };
  const listMessages = { execute: vi.fn() };
  const getMessageMedia = { execute: vi.fn() };
  const getContactPhoto = { execute: vi.fn() };
  const realtime = { attach: vi.fn() };
  const receiveWebhook = {
    execute: vi.fn().mockResolvedValue({ accepted: true }),
  };
  const verifyChallenge = { execute: vi.fn() };
  const session = { connect: vi.fn(), status: vi.fn(), disconnect: vi.fn() };
  const listContacts = { execute: vi.fn() };
  const createContact = { execute: vi.fn() };
  const updateContact = { execute: vi.fn() };
  const listConversations = { execute: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MessagingController],
      providers: [
        { provide: SendMessageUseCase, useValue: sendMessageUseCase },
        { provide: SendPresenceUseCase, useValue: sendPresenceUseCase },
        { provide: GetCapabilitiesUseCase, useValue: getCapabilitiesUseCase },
        { provide: ListConnectionsUseCase, useValue: listConnections },
        { provide: CreateConnectionUseCase, useValue: createConnection },
        { provide: RestoreConnectionUseCase, useValue: restoreConnection },
        { provide: UpdateConnectionUseCase, useValue: updateConnection },
        { provide: SetDefaultConnectionUseCase, useValue: setDefault },
        { provide: ArchiveConnectionUseCase, useValue: archiveConnection },
        { provide: CheckConnectionHealthUseCase, useValue: checkHealth },
        { provide: ListMessagesUseCase, useValue: listMessages },
        { provide: GetMessageMediaUseCase, useValue: getMessageMedia },
        { provide: GetContactPhotoUseCase, useValue: getContactPhoto },
        { provide: MessagingEventsService, useValue: realtime },
        { provide: ReceiveWebhookUseCase, useValue: receiveWebhook },
        { provide: VerifyWebhookChallengeUseCase, useValue: verifyChallenge },
        { provide: MessagingSessionUseCase, useValue: session },
        { provide: ListContactsUseCase, useValue: listContacts },
        { provide: CreateContactUseCase, useValue: createContact },
        { provide: UpdateContactUseCase, useValue: updateContact },
        { provide: ListConversationsUseCase, useValue: listConversations },
        {
          provide: FeatureFlagService,
          useValue: { isEnabled: vi.fn().mockResolvedValue(true) },
        },
        { provide: CheckAccessUseCase, useValue: { execute: vi.fn() } },
      ],
    }).compile();
    controller = module.get(MessagingController);
  });

  // api-conventions.md: o Nest casa por ordem de declaração, não por especificidade.
  // Sem este spec, reordenar handlers deixa uma rota inalcançável sem erro em lugar nenhum.
  describe('roteamento', () => {
    it('parâmetro só em recurso por id: messages, contacts e connections', () => {
      const declared = routes();
      expect(
        declared
          .filter((r) => r.path.includes(':'))
          .map((r) => `${r.verb} ${r.path}`),
      ).toEqual([
        'GET messages/:id/media',
        'GET contacts/:id/photo',
        'PATCH contacts/:id',
        'POST connections/:id/restore',
        'PUT connections/:id/default',
        'PUT connections/:id',
        'DELETE connections/:id',
        'GET connections/:id/capabilities',
        'GET connections/:id/health',
        'POST connections/:id/session',
        'GET connections/:id/session',
        'DELETE connections/:id/session',
      ]);
      expect(
        declared
          .filter((r) => !r.path.includes(':'))
          .every((r) => r.segments === 1),
      ).toBe(true);
    });

    it('não há dois handlers com o mesmo verbo e path', () => {
      const keys = routes().map((r) => `${r.verb} ${r.path}`);
      expect(new Set(keys).size).toBe(keys.length);
    });

    it('contrato de rotas está congelado', () => {
      expect(
        new Set(routes().map((r) => `${r.verb} /messaging/${r.path}`)),
      ).toEqual(
        new Set([
          'POST /messaging/messages',
          'POST /messaging/presence',
          'GET /messaging/messages',
          'GET /messaging/messages/:id/media',
          'GET /messaging/contacts',
          'POST /messaging/contacts',
          'GET /messaging/conversations',
          'GET /messaging/contacts/:id/photo',
          'GET /messaging/events',
          'PATCH /messaging/contacts/:id',
          'GET /messaging/connections',
          'POST /messaging/connections',
          'POST /messaging/connections/:id/restore',
          'PUT /messaging/connections/:id/default',
          'PUT /messaging/connections/:id',
          'GET /messaging/connections/:id/capabilities',
          'GET /messaging/connections/:id/health',
          'POST /messaging/connections/:id/session',
          'GET /messaging/connections/:id/session',
          'DELETE /messaging/connections/:id/session',
          'DELETE /messaging/connections/:id',
          'GET /messaging/webhook',
          'POST /messaging/webhook',
        ]),
      );
    });
  });

  describe('webhook', () => {
    // O HMAC da Meta é sobre estes bytes: reserializar aqui invalidaria a assinatura.
    it('repassa corpo CRU, headers e query — sem parsear', async () => {
      const raw = Buffer.from('{"entry":[]}', 'utf8');
      await controller.webhook(
        {
          rawBody: raw,
          headers: { 'x-hub-signature-256': 'sha256=abc' },
        } as never,
        { key: 'k' },
      );

      expect(receiveWebhook.execute).toHaveBeenCalledWith({
        raw,
        headers: { 'x-hub-signature-256': 'sha256=abc' },
        query: { key: 'k' },
      });
    });

    it('sem rawBody manda buffer vazio, não undefined', async () => {
      await controller.webhook({ headers: {} } as never, {});
      expect(receiveWebhook.execute).toHaveBeenCalledWith(
        expect.objectContaining({ raw: Buffer.alloc(0) }),
      );
    });

    it('handshake devolve o challenge quando o use-case aprova', async () => {
      verifyChallenge.execute.mockResolvedValue('12345');
      expect(
        await controller.webhookChallenge({ 'hub.challenge': '12345' }),
      ).toBe('12345');
    });

    it('handshake reprovado vira 403, não 200 mudo', async () => {
      verifyChallenge.execute.mockResolvedValue(null);
      await expect(controller.webhookChallenge({})).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('handlers', () => {
    it('conexões: lista, cria e edita com o usuário autenticado', async () => {
      const dto = { provider: 'EVOLUTION_API', config: {} } as never;
      await controller.connections('true');
      await controller.createConnectionHandler(dto, { id: 'u1' } as never);
      await controller.restoreConnectionHandler('c1', dto, {
        id: 'u1',
      } as never);
      await controller.updateConnectionHandler('c1', dto, {
        id: 'u1',
      } as never);

      expect(listConnections.execute).toHaveBeenCalledWith({ archived: true });
      expect(createConnection.execute).toHaveBeenCalledWith(dto, 'u1');
      expect(restoreConnection.execute).toHaveBeenCalledWith('c1', dto, 'u1');
      expect(updateConnection.execute).toHaveBeenCalledWith('c1', dto, 'u1');
    });

    it('conexão padrão: troca pela conexão pedida', async () => {
      await controller.setDefaultHandler('c1');
      expect(setDefault.execute).toHaveBeenCalledWith('c1');
    });

    it('arquivar: delega a conexão pedida', async () => {
      await controller.archiveConnectionHandler('c1');
      expect(archiveConnection.execute).toHaveBeenCalledWith('c1');
    });

    it('sessão, health e capabilities são sempre de UMA conexão', async () => {
      await controller.connectSession('c1');
      await controller.sessionStatus('c1');
      await controller.disconnectSession('c1');
      await controller.health('c1');
      await controller.capabilities('c1');

      expect(session.connect).toHaveBeenCalledWith('c1');
      expect(session.status).toHaveBeenCalledWith('c1');
      expect(session.disconnect).toHaveBeenCalledWith('c1');
      expect(checkHealth.execute).toHaveBeenCalledWith('c1');
      expect(getCapabilitiesUseCase.execute).toHaveBeenCalledWith('c1');
    });

    it('sendMessage usa o id do usuário autenticado, nunca o do corpo', async () => {
      const dto = { phone: '5511987654321', text: 'oi' };
      const res = await controller.sendMessage(dto, { id: 'user-7' } as never);

      expect(sendMessageUseCase.execute).toHaveBeenCalledWith(
        dto,
        'user-7',
        undefined,
      );
      expect(res).toEqual({ id: 'msg-1' });
    });

    it('sendMessage repassa o arquivo anexado', async () => {
      const file = {
        buffer: Buffer.from('x'),
        mimetype: 'image/png',
        originalname: 'a.png',
      };
      await controller.sendMessage(
        { phone: '5511987654321' },
        { id: 'u' } as never,
        file,
      );
      expect(sendMessageUseCase.execute).toHaveBeenCalledWith(
        { phone: '5511987654321' },
        'u',
        file,
      );
    });

    describe('contactPhoto', () => {
      it('serve a imagem com cabeçalhos de segurança e cache privado', async () => {
        getContactPhoto.execute.mockResolvedValue({
          data: Buffer.from('jpg'),
          mimeType: 'image/jpeg',
        });
        const r = { set: vi.fn() };
        await controller.contactPhoto('contact-1', r as never);

        expect(getContactPhoto.execute).toHaveBeenCalledWith('contact-1');
        expect(r.set.mock.calls[0][0]).toMatchObject({
          'Content-Type': 'image/jpeg',
          'X-Content-Type-Options': 'nosniff',
          'Cache-Control': 'private, max-age=3600',
        });
      });
    });

    describe('events (SSE)', () => {
      it('não gasta o limite global do throttler (cada reconexão contaria como consulta)', () => {
        expect(
          Reflect.getMetadata('THROTTLER:SKIPdefault', controller.events),
        ).toBe(true);
      });

      it('abre o stream e desfaz tudo quando o cliente sai', () => {
        const detach = vi.fn();
        realtime.attach.mockReturnValue(detach);
        const handlers: Record<string, () => void> = {};
        const res = { set: vi.fn(), flushHeaders: vi.fn(), write: vi.fn(), end: vi.fn() };
        const req = { on: (ev: string, fn: () => void) => (handlers[ev] = fn) };

        controller.events(req as never, res as never);

        expect(res.set.mock.calls[0][0]).toMatchObject({
          'Content-Type': 'text/event-stream',
          'X-Accel-Buffering': 'no',
        });
        // O que o facade escreve vai direto à resposta.
        realtime.attach.mock.calls[0][0]('data: {}\n\n');
        expect(res.write).toHaveBeenCalledWith('data: {}\n\n');

        // O limite de vida encerra a resposta pelo mesmo `end` repassado ao facade.
        realtime.attach.mock.calls[0][1]();
        expect(res.end).toHaveBeenCalledOnce();

        handlers.close();
        expect(detach).toHaveBeenCalledOnce();
      });
    });

    describe('media', () => {
      const res = () => ({ set: vi.fn() });

      it('mídia segura sai inline, com cabeçalhos que impedem execução', async () => {
        getMessageMedia.execute.mockResolvedValue({
          data: Buffer.from('png'),
          mimeType: 'image/png',
          fileName: 'foto ç.png',
          inline: true,
        });
        const r = res();
        await controller.media('m1', undefined, r as never);

        expect(getMessageMedia.execute).toHaveBeenCalledWith('m1');
        const headers = r.set.mock.calls[0][0];
        expect(headers['Content-Type']).toBe('image/png');
        expect(headers['Content-Disposition']).toBe(
          "inline; filename*=UTF-8''foto%20%C3%A7.png",
        );
        expect(headers['X-Content-Type-Options']).toBe('nosniff');
        expect(headers['Content-Security-Policy']).toBe('sandbox');
      });

      it('Range devolve 206 só com o trecho pedido', async () => {
        getMessageMedia.execute.mockResolvedValue({
          data: Buffer.from('0123456789'),
          mimeType: 'audio/ogg',
          inline: true,
        });
        const r = { set: vi.fn(), status: vi.fn() };
        const body = (await controller.media(
          'm1',
          'bytes=2-5',
          r as never,
        )) as {
          getStream: () => NodeJS.ReadableStream;
        };

        expect(r.status).toHaveBeenCalledWith(206);
        expect(r.set).toHaveBeenLastCalledWith({
          'Content-Range': 'bytes 2-5/10',
          'Content-Length': '4',
        });
        const chunks: Buffer[] = [];
        for await (const chunk of body.getStream())
          chunks.push(chunk as Buffer);
        expect(Buffer.concat(chunks).toString()).toBe('2345');
      });

      it('Range fora do conteúdo é 416', async () => {
        getMessageMedia.execute.mockResolvedValue({
          data: Buffer.from('abc'),
          mimeType: 'audio/ogg',
          inline: true,
        });
        const r = { set: vi.fn(), status: vi.fn() };
        await controller.media('m1', 'bytes=50-', r as never);
        expect(r.status).toHaveBeenCalledWith(416);
        expect(r.set).toHaveBeenLastCalledWith('Content-Range', 'bytes */3');
      });

      it('mídia não segura força download', async () => {
        getMessageMedia.execute.mockResolvedValue({
          data: Buffer.from('x'),
          mimeType: 'application/octet-stream',
          inline: false,
        });
        const r = res();
        await controller.media('m1', undefined, r as never);
        expect(r.set.mock.calls[0][0]['Content-Disposition']).toBe(
          'attachment',
        );
      });
    });

    it('list repassa os filtros já validados ao use-case', async () => {
      const query = {
        page: 2,
        limit: 5,
        direction: 'INBOUND' as const,
        pagination: true,
      };
      await controller.list(query);
      expect(listMessages.execute).toHaveBeenCalledWith(query);
    });

    it('listContacts repassa paginação e busca já validadas', async () => {
      const query = { page: 2, limit: 5, search: 'Ana', pagination: true };
      await controller.listContactsHandler(query);
      expect(listContacts.execute).toHaveBeenCalledWith(query);
    });

    it('updateContact repassa o telefone e somente os campos editáveis', async () => {
      await controller.updateContactHandler('contact-1', {
        name: 'Ana',
        optOut: true,
      });
      expect(updateContact.execute).toHaveBeenCalledWith('contact-1', {
        name: 'Ana',
        optOut: true,
      });
    });

    it('conversations repassa o telefone ao use-case', async () => {
      await controller.conversationsHandler({ phone: '5511987654321' });
      expect(listConversations.execute).toHaveBeenCalledWith(
        '5511987654321',
      );
    });
  });
});
